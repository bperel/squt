# Use example : 
# perl myparse_to_squt.pl "SELECT b.a FROM b"

use strict;
use DBIx::MyParse;
use Data::Dumper;
use Storable qw(dclone);
use JSON::PP;
my $json = JSON::PP->new->ascii->pretty->allow_nonref;
$Data::Dumper::Indent = 1;

our $parser = DBIx::MyParse->new( database => "test", datadir => "/tmp/myparse");
our $query = $parser->parse($ARGV[0]);
our $curQuery;
our $debug = $ARGV[1] eq "debug";
our %sqlv_tables_final; # Includes sub-selects
our %outputAliases;
our %sqlv_tables;
our $subquery_id=-1;

if ($debug) {
	print "Dumped:\n";
	print Dumper $query;
}

sub handleQuery($) {
	my ($queryToHandle) = @_;
	$curQuery = dclone($queryToHandle);
	
	if ($curQuery->getCommand() eq "SQLCOM_ERROR") {
		$sqlv_tables_final{"Error"}=$curQuery->getErrstr();
	}
	elsif ($curQuery->getCommand() ne "SQLCOM_SELECT") {
		$sqlv_tables_final{"Error"}="Only SELECT queries are supported for now";
	}
	else {
		foreach my $selectItem (@{$curQuery->getSelectItems()}) {
			handleSelectItem($selectItem,-1,1);
		}
		if ($curQuery->getTables() ne undef) {
			foreach my $item (@{$curQuery->getTables()}) {
				if ($item->getType() eq "JOIN_ITEM") {
					handleJoin($item);
				}
				elsif ($item->getType() eq "SUBSELECT_ITEM") {
					handleSubquery($item,0);
				}
			}
		}
		if ($curQuery->getOrder() ne undef) {
			foreach my $orderByItem (@{$curQuery->getOrder()}) {
				handleOrderBy($orderByItem);
			}
		}
		if ($curQuery->getWhere() ne undef) {
			handleWhere($curQuery->getWhere());
		}
	}
	if ($subquery_id == -1) {
		%sqlv_tables_final = (%sqlv_tables_final, %{dclone(\%sqlv_tables)});
	}
	else {
		$sqlv_tables_final{"Subqueries"}{$subquery_id} = dclone (\%sqlv_tables);
	}
}

handleQuery($query);

print $json->pretty->encode( \%sqlv_tables_final );


sub handleJoin {
	my $item = $_[0];
	if ($item->getType() eq "JOIN_ITEM") {
		my $two_tables = 1;
		foreach my $sub_item (@{$item->getJoinItems()}) {
			if ($sub_item->getType() ne "TABLE_ITEM") {
				$two_tables = 0;			
			}
		}
		my $joinCond = $item->getJoinCond();
		my $joinFields = $item->getJoinFields();
		my $table = @{$item->getJoinItems()}[0];
		my $table2 = @{$item->getJoinItems()}[1];
		
		if ($item->getJoinType() eq "JOIN_TYPE_NATURAL") {
			setWarning("Not supported","Natural joins","between ".$table->getAlias()." and ".$table2->getAlias());
			return;
		}
		
		my $field1;
		my $field2;
		if ($two_tables) {
			if ($joinCond ne undef 
			 && $joinCond->getType() eq "FUNC_ITEM") {
				$field1 = @{$joinCond->getArguments()}[0];
				$field2 = @{$joinCond->getArguments()}[1];
			}
			elsif ($joinFields ne undef) {
				$field1 = $field2 = @{$joinFields}[0];
			}
			else {
				return;
			}
			
			my $joinType = $item->getJoinType();
			if ($joinType eq undef) {
				$joinType = "JOIN_TYPE_STRAIGHT";
			}
			$sqlv_tables{"Tables"}{$table->getTableName()}{$table->getAlias()}{"CONDITION"}{$field1->getFieldName()}{"JOIN"}
														  {$table2->getAlias.".".$field2->getFieldName()}=$joinType;
			if ($sqlv_tables{"Tables"}{$table2->getTableName()}{$table2->getAlias()} eq undef) {
				$sqlv_tables{"Tables"}{$table2->getTableName()}{$table2->getAlias()}{"EXISTS"}=1;
			}
		}
	}
}

sub handleSelectItem($$$) {
	my ($item,$functionId,$directOutput) = @_;
	if ($item->getType() eq 'FIELD_ITEM') {
		my $tableName = getItemTableName($item);
		if ($tableName == -1 && $item->getFieldName() ne "*") {
			return;
		}
		my $fieldAlias = $item->getAlias() || $item->getFieldName();
		if ($tableName eq "?") {
			if ($item->getFieldName() eq "*") {
				foreach my $tableOrJoin (@{$curQuery->getTables()}) {
					if ($tableOrJoin->getType() eq "JOIN_ITEM") {
						foreach my $sub_item (@{$tableOrJoin->getJoinItems()}) {
							if ($sub_item->getType() eq "TABLE_ITEM") {
								$sqlv_tables{"Tables"}{getSqlTableName($sub_item->getTableName())}
									{$sub_item->getTableName()}{"OUTPUT"}{"*"}{$functionId}=$fieldAlias;
							}
						}
					}
					else {
						$sqlv_tables{"Tables"}{getSqlTableName($tableOrJoin->getTableName())}
							{$tableOrJoin->getTableName()}{"OUTPUT"}{"*"}{$functionId}=$fieldAlias;
					}
				}
				return;
			}
			setWarning("No alias field ignored",$item->getFieldName(),"SELECT");
		}
		$sqlv_tables{"Tables"}{getSqlTableName($tableName)}{$tableName}
							  {"OUTPUT"}{$item->getFieldName()}{$functionId}=$fieldAlias;
		
	}
	elsif ($item->getType() eq 'SUBSELECT_ITEM') {
		handleSubquery($item,0);
	}
	elsif ($item->getType() eq 'INT_ITEM' || $item->getType() eq 'DECIMAL_ITEM'|| $item->getType() eq 'REAL_ITEM'
		|| $item->getType() eq 'STRING_ITEM') {
		$sqlv_tables{"Functions"}{$functionId}{"Constants"}{$item->getValue()}=$item->getValue();
	}
	elsif ($item->getType() eq 'INTERVAL_ITEM') {
		$sqlv_tables{"Functions"}{$functionId}{"Constants"}{$item->getInterval()}=$item->getInterval();
	}
	elsif ($item->getType() eq 'USER_VAR_ITEM') {
		my $var_item=$item->getVarName();
		$sqlv_tables{"Functions"}{$functionId}{"Constants"}{$var_item}=$var_item;
	}
	elsif ($item->getType() eq 'SYSTEM_VAR_ITEM') {
		my $component_and_variable=$item->getVarComponent().".".$item->getVarName();
		$sqlv_tables{"Functions"}{$functionId}{"Constants"}{$component_and_variable}=$component_and_variable;
	}
	elsif ($item->getType() eq 'FUNC_ITEM') {
		my $functionAlias=$item->getAlias();
		if ($functionAlias eq undef) {
			if ($directOutput) {
				setWarning("No alias",$item->getFuncName(),"SELECT");
			}
			$functionAlias=scalar keys %{$sqlv_tables{"Functions"}};
		}
		$sqlv_tables{"Functions"}{$functionAlias}{"name"}=$item->getFuncName();
		$sqlv_tables{"Functions"}{$functionAlias}{"alias"}=$functionAlias;
		$sqlv_tables{"Functions"}{$functionAlias}{"to"}=($functionId == -1 ? "OUTPUT" : $functionId);
		foreach my $argument (@{$item->getArguments()}) {
			handleSelectItem($argument,$functionAlias,0);
		}
	}
}

sub handleWhere(\@) {
	my ($where) = @_;
	my $fieldname;
	my $tablename;
	my $value;
	my $j=0;
	if ($where->getItemType() eq 'FIELD_ITEM') {
		my @fieldInfos = getInfosFromFieldInWhere($where, undef);
		if (@fieldInfos ne undef) {
			my($tablename, $fieldname) = @fieldInfos;
			$sqlv_tables{"Tables"}{getSqlTableName($tablename)}{$tablename}
						{"CONDITION"}{$fieldname}{"EXISTS"}="1";
		}
	}
	elsif ($where->getItemType() eq 'SUBSELECT_ITEM') {
		handleSubquery($where, 1);
	}
	elsif ($where->getItemType() eq 'FUNC_ITEM') {
		handleFunctionInWhere($where);
	}
	elsif ($where->getItemType() eq 'COND_ITEM') {
		foreach my $whereArgument (@{$where->getArguments()}) {
			if ($whereArgument->getType() eq 'FUNC_ITEM') {
				handleFunctionInWhere($whereArgument);
			}
			elsif ($whereArgument->getType() eq 'FIELD_ITEM') {
				my @fieldInfos = getInfosFromFieldInWhere($whereArgument, $fieldname);
				if (@fieldInfos eq undef) {
					return;
				}
				if ($fieldInfos[1] ne undef) {
					$tablename=$fieldInfos[0];
					$fieldname=$fieldInfos[1];
				}
				else { 
					$value=$fieldInfos[0].".".$fieldInfos[1];
				}
			}
			elsif ($whereArgument->getType() eq 'INT_ITEM' || $whereArgument->getType() eq 'DECIMAL_ITEM'|| $whereArgument->getType() eq 'REAL_ITEM'
				|| $whereArgument->getType() eq 'STRING_ITEM') {
				
				$value=$whereArgument->getValue();
			}
			#	foreach my $sub_item (@{$whereArgument->getCondItems()}) {
			#		handleWhere($sub_item);
			#	}
		}
		if ($fieldname ne undef && $value ne undef) {
			$sqlv_tables{"Tables"}{getSqlTableName($tablename)}{$tablename}
						{"CONDITION"}{$fieldname}{"VALUE"}=$value;
		}
	}
}

sub handleFunctionInWhere($$) {
	my ($function,$destination) = @_;
	my $functionAlias = $function->getAlias();
	if ($functionAlias eq undef) {
		$functionAlias=scalar keys %{$sqlv_tables{"Functions"}};
	}
	my $tablename;
	my $fieldname;
	my $tablename2;
	my $fieldname2;
	foreach my $functionArgument (@{$function->getArguments()}) {
		if ($functionArgument->getType() eq 'FIELD_ITEM') {
			my @fieldInfos = getInfosFromFieldInWhere($functionArgument, $fieldname);
			my $tableName = getItemTableName($functionArgument);
			if ($tableName eq "?") {
				setWarning("No alias field ignored",$functionArgument->getFieldName(),"SELECT");
			}
			$sqlv_tables{"Tables"}{getSqlTableName($tableName)}{$tableName}
								  {"OUTPUT"}{$functionArgument->getFieldName()}{$functionAlias}
								 =$functionArgument->getAlias() 
							   || $functionArgument->getFieldName();
		}
		elsif ($functionArgument->getType() eq 'INT_ITEM' 
			|| $functionArgument->getType() eq 'DECIMAL_ITEM'
			|| $functionArgument->getType() eq 'REAL_ITEM'
			|| $functionArgument->getType() eq 'STRING_ITEM') {
			$sqlv_tables{"Functions"}{$functionAlias}{"Constants"}{$functionArgument->getValue()}=$functionArgument->getValue();
		}
		elsif ($functionArgument->getType() eq 'FUNC_ITEM') {
			handleFunctionInWhere($functionArgument,$functionAlias);
		}
	}
	
	$sqlv_tables{"Functions"}{$functionAlias}{"name"}=$function->getFuncName();
	$sqlv_tables{"Functions"}{$functionAlias}{"to"}= $destination || "NOWHERE";

}

sub getInfosFromFieldInWhere($$) {
	my ($whereArgument,$fieldname) = @_;
	my @fieldInfos; # table name then field name if $fieldname doesn't already exist, full field name else
	my $tableName = getItemTableName($whereArgument);
	if ($tableName eq "?") {
		setWarning("No alias field ignored",$whereArgument->getFieldName(),"WHERE or JOIN");
		$fieldInfos[0]="?";
	}
	else {
		$fieldInfos[0]=$tableName;
	}
	$fieldInfos[1]=$whereArgument->getFieldName();
	return @fieldInfos;
}

sub handleOrderBy($) {
	my ($orderByItem) = @_;
	if ($orderByItem->getTableName() eq undef) {
		setWarning("No alias field ignored",$orderByItem->getFieldName(),"ORDER");
	}
	else {
		$sqlv_tables{"Tables"}{getSqlTableName($orderByItem->getTableName())}{$orderByItem->getTableName()}
					{"SORT"}{$orderByItem->getFieldName()}=$orderByItem->getDirection();
	}
}

sub handleSubquery($$) {
	my ($item, $isWhere) = @_;
	my $superQuery_id=$subquery_id;
	my $superQuery=dclone($curQuery);
	my $superQueryTables=dclone (\%sqlv_tables);
	$subquery_id=scalar keys %{$sqlv_tables_final{"Subqueries"}};
	%sqlv_tables = ();
	handleQuery($item->getSubselectQuery());
	
	my $subquery_alias = $item->getAlias();
	if ($subquery_alias eq undef) {
		my $uniqueSubqueryOutputField = getUniqueSubqueryOutputField($subquery_id);
		if ($isWhere || $uniqueSubqueryOutputField eq undef) {
			setWarning("No alias","subquery #".$subquery_id);
		}
		else {
			$subquery_alias = $uniqueSubqueryOutputField;
		}
	}
	$sqlv_tables_final{"Subqueries"}{$subquery_id}{"SubqueryAlias"}=$subquery_alias || $subquery_id;
	$sqlv_tables_final{"Subqueries"}{$subquery_id}{"SubqueryType"}=$item->getSubselectType();
	%sqlv_tables = %{$superQueryTables};
	$curQuery=$superQuery;
	
	my $subselectExpr=$item->getSubselectExpr();
	if ($isWhere && $subselectExpr ne undef) {
		if ($subselectExpr->getType() eq 'FIELD_ITEM') {
			my @fieldInfos = getInfosFromFieldInWhere($subselectExpr, undef);
			if (@fieldInfos ne undef) {
				my($tablename, $fieldname) = @fieldInfos;
				$sqlv_tables{"Tables"}{getSqlTableName($tablename)}{$tablename}
							{"CONDITION"}{$fieldname}{$item->getSubselectType()}=$subquery_id;
			}
		}
	}
	$subquery_id=$superQuery_id;
}

sub setWarning {
	my $warning_type = $_[0];
	my $concerned_field = $_[1];
	my $extra_info = $_[2] || "";
	$sqlv_tables_final{"Warning"}{$warning_type}{$concerned_field}=$extra_info;
}

sub getItemTableName($) {
	my ($item) = @_;
	if ($item->getTableName() ne undef) {
		return $item->getTableName();
	}
	if ($curQuery->getTables() eq undef) {
		return undef;
	}
	else {
	 	if (scalar @{$curQuery->getTables()} == 1) {
	 		if (@{$curQuery->getTables()}[0]->getType() eq "TABLE_ITEM") {
	 			return @{$curQuery->getTables()}[0]->getTableName();
	 		}
	 		elsif (@{$curQuery->getTables()}[0]->getType() eq "SUBSELECT_ITEM") {
	 			return -1;
	 		}
	 	}
	 }
	 return "?";
}

sub getSqlTableName($) {
	my ($tableAlias) = @_;
	if ($curQuery->getTables() eq undef || $tableAlias eq undef) {
		return undef;
	}
	elsif ($tableAlias eq "?") {
		return "?";
	}
	my $tableName;
	foreach my $table (@{$curQuery->getTables()}) {
		$tableName = getSqlTableNameFromTable($tableAlias,$table);
		if ($tableName ne undef) {
			return $tableName;
		}
	}
	return undef;
}

sub getSqlTableNameFromTable($$) {
	my ($tableAlias, $table) = @_;
	my $tableName;
	if ($table->getType() eq "JOIN_ITEM") {
		foreach my $sub_item (@{$table->getJoinItems()}) {
			$tableName = getSqlTableNameFromTable($tableAlias,$sub_item);
			if ($tableName ne undef) {
				return $tableName;
			}
		}
	}
	else {
		if ($table->getAlias() eq $tableAlias) {
			return $table->getTableName();
		}
	}
}

sub getUniqueSubqueryOutputField($) {
	my ($subquery_id) = @_;
	my %subqueryTables = %{$sqlv_tables_final{"Subqueries"}{$subquery_id}{"Tables"}};
 	if (scalar %subqueryTables == 1) {
 		my @subqueryTableNames = keys(%subqueryTables);
 		my %subqueryTableAliases = %{$subqueryTables{$subqueryTableNames[0]}};
		if (scalar %subqueryTableAliases == 1) {
 			my @subqueryTableFieldNames = keys(%subqueryTableAliases);
 			my %subqueryTableFields = %{$subqueryTableAliases{$subqueryTableFieldNames[0]}{"OUTPUT"}};
			if (scalar %subqueryTableFields == 1) {
 				my @tableFields = keys(%subqueryTableFields);
 				return $tableFields[0];
			}
		}
	}
	return undef;
}