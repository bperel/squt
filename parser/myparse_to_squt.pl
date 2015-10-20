# Usage example :
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
our $debug = defined $ARGV[1] && $ARGV[1] eq "debug";
our %sqlv_tables_final; # Includes sub-selects
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
		setError($curQuery->getErrstr());
	}
	elsif ($curQuery->getCommand() ne "SQLCOM_SELECT" || $curQuery->getOrigCommand() ne "SQLCOM_END") {
		setError("Only SELECT queries are supported for now");
	}
	else {
		my $optionsReturnedError = 0;
		foreach my $optionName (@{$curQuery->getOptions()}) {
			if (handleOption($optionName) eq 0) {
				$optionsReturnedError = 1;
				last; # Break on first error
			}
		}
		if ($optionsReturnedError eq 0) {
			foreach my $selectItem (@{$curQuery->getSelectItems()}) {
				handleSelectItem($selectItem,"-1",1);
			}
			if (defined $curQuery->getTables()) {
				foreach my $item (@{$curQuery->getTables()}) {
					if ($item->getType() eq "JOIN_ITEM") {
						handleJoin($item);
					}
					elsif ($item->getType() eq "SUBSELECT_ITEM") {
						handleSubquery($item,0);
					}
				}
			}
			if (defined $curQuery->getOrder()) {
				foreach my $orderByItem (@{$curQuery->getOrder()}) {
					handleOrderBy($orderByItem);
				}
			}
			if (defined $curQuery->getWhere()) {
				handleWhere($curQuery->getWhere());
			}
			if (defined $curQuery->getGroup()) {
				foreach my $groupByItem (@{$curQuery->getGroup()}) {
					handleGroupBy($groupByItem);
				}
			}
			if (defined $curQuery->getHaving()) {
				handleHaving($curQuery->getHaving());
			}
			if (defined $curQuery->getLimit()) {
				handleLimit($curQuery->getLimit());
			}
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

sub handleOption {
	my ($optionName) = @_;
	if (grep $_ eq $optionName, qw/SELECT_DESCRIBE DESCRIBE_NORMAL SELECT_DESCRIBE/) {
		setError("Only SELECT queries are supported for now");
		return 0;
	}
	if (grep $_ eq $optionName, qw/OPTION_BUFFER_RESULT OPTION_FOUND_ROWS OPTION_TO_QUERY_CACHE SELECT_BIG_RESULT SELECT_DISTINCT SELECT_SMALL_RESULT SELECT_STRAIGHT_JOIN SQL_NO_CACHE TL_READ_HIGH_PRIORITY TL_READ_WITH_SHARED_LOCKS TL_WRITE/) {
		$sqlv_tables{"Options"}{$optionName}=1;
	}
	elsif (grep $_ eq $optionName, qw/TL_READ/) {
		# Ignore : internal option
	}
	else {
		setWarning("Not supported","Option",$optionName);
	}
	return 1;
}


sub handleJoin {
	my ($item) = @_;
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
			if (defined $joinCond
			 && $joinCond->getType() eq "FUNC_ITEM") {
				$field1 = @{$joinCond->getArguments()}[0];
				$field2 = @{$joinCond->getArguments()}[1];
			}
			elsif (defined $joinFields) {
				$field1 = $field2 = @{$joinFields}[0];
			}
			else {
				return;
			}
			
			my $joinType = $item->getJoinType();
			if (!defined $joinType) {
				$joinType = "JOIN_TYPE_STRAIGHT";
			}
			$sqlv_tables{"Tables"}{$table->getTableName()}{$table->getAlias()}{"CONDITION"}{$field1->getFieldName()}{"JOIN"}
														  {$table2->getAlias.".".$field2->getFieldName()}=$joinType;
			if (!defined $sqlv_tables{"Tables"}{$table2->getTableName()}{$table2->getAlias()}) {
				$sqlv_tables{"Tables"}{$table2->getTableName()}{$table2->getAlias()}{"EXISTS"}=1;
			}
		}
	}
}

sub handleSelectItem($$$) {
	my ($item,$functionId,$directOutput) = @_;
	my $itemType = $item->getType();
	if ($itemType eq 'FIELD_ITEM') {
		my $tableName = getItemTableName($item);
		if (defined $tableName && $tableName eq "-1" && $item->getFieldName() ne "*") {
			return;
		}
		my $fieldAlias = $item->getAlias() || $item->getFieldName();
		if (defined $tableName && $tableName eq "?") {
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
			setWarning("No alias field ignored",$item->getFieldName(),"field","SELECT");
		}
		$sqlv_tables{"Tables"}{getSqlTableName($tableName)}{$tableName}
							  {"OUTPUT"}{$item->getFieldName()}{$functionId}=$fieldAlias;
		
	}
	elsif ($itemType eq 'SUBSELECT_ITEM') {
		handleSubquery($item,0);
	}
	elsif ($itemType eq 'ROW_ITEM') {
		foreach my $argument (@{$item->getArguments()}) {
			handleSelectItem($argument,$functionId,0);
		}
	}
	elsif( grep $_ eq $itemType, qw/INT_ITEM DECIMAL_ITEM REAL_ITEM STRING_ITEM NULL_ITEM INTERVAL_ITEM USER_VAR_ITEM SYSTEM_VAR_ITEM/) {
		my $value;
		if ($itemType eq 'INTERVAL_ITEM') {
			$value=$item->getInterval();
		}
		elsif ($itemType eq 'USER_VAR_ITEM') {
			$value=$item->getVarName();
		}
		elsif ($itemType eq 'SYSTEM_VAR_ITEM') {
			$value=$item->getVarComponent().".".$item->getVarName()
		}
		
		else {
			$value=$item->getValue();
		}
		if ($functionId eq "-1") { # direct output
			my $constantAlias=$item->getAlias();
			if (!defined $value) {
				$value="NULL";
			}
			if (!defined $constantAlias) {
				$constantAlias=$value;
			}
			
			my $constantKey = scalar keys %{$sqlv_tables{"Constants"}};
			$sqlv_tables{"Constants"}{$constantKey}{"value"}=$value;
			$sqlv_tables{"Constants"}{$constantKey}{"alias"}=$constantAlias;
			$sqlv_tables{"Constants"}{$constantKey}{"to"}="OUTPUT";
		}
		else {
			$sqlv_tables{"Functions"}{$functionId}{"Constants"}{$value}=$value;
		}
	}
	elsif (grep $_ eq $itemType, qw/FUNC_ITEM SUM_FUNC_ITEM/) {
		my $functionName = $itemType eq 'SUM_FUNC_ITEM' ? $item->getFuncType() : $item->getFuncName();		
		my $functionAlias = getUniqueFunctionAlias($item, $directOutput);
		
		if ($itemType eq 'SUM_FUNC_ITEM') {
		    $sqlv_tables{"Functions"}{$functionAlias}{"group"}="1";
        }

		$sqlv_tables{"Functions"}{$functionAlias}{"alias"}=$functionAlias;
		$sqlv_tables{"Functions"}{$functionAlias}{"to"}=($functionId eq "-1" ? "OUTPUT" : $functionId);
		$sqlv_tables{"Functions"}{$functionAlias}{"name"}=$functionName;
		foreach my $argument (@{$item->getArguments()}) {
			handleSelectItem($argument,$functionAlias,0);
		}
	}
}

sub handleWhere(\@) {
	my ($where) = @_;
	my $itemType = $where->getItemType();
	if ($itemType eq 'FIELD_ITEM') {
		my @fieldInfos = getInfosFromFieldInWhere($where, undef);
		if (@fieldInfos) {
			my($tablename, $fieldname) = @fieldInfos;
			my $functionAlias = getUniqueFunctionAlias($where, 0);

			$sqlv_tables{"Tables"}{getSqlTableName($tablename)}{$tablename}
						{"CONDITION"}{$fieldname}{"EXISTS"}=$functionAlias;

			$sqlv_tables{"Functions"}{$functionAlias}{"name"}="EXISTS";
			$sqlv_tables{"Functions"}{$functionAlias}{"to"}= "NOWHERE";
		}
	}
	elsif ($itemType eq 'SUBSELECT_ITEM') {
		handleSubquery($where, 1);
	}
	elsif ($itemType eq 'FUNC_ITEM') {
		handleFunctionInWhere($where);
	}
	elsif ($itemType eq 'COND_ITEM') {
		my $tablename;
		my $fieldname;
		my $value;

		foreach my $whereArgument (@{$where->getArguments()}) {
			my $argumentType = $whereArgument->getType();
			if ($argumentType eq 'FUNC_ITEM') {
				handleFunctionInWhere($whereArgument);
			}
			elsif ($argumentType eq 'FIELD_ITEM') {
				my @fieldInfos = getInfosFromFieldInWhere($whereArgument, undef);
				if (! @fieldInfos) {
					return;
				}
				if (defined $fieldInfos[1]) {
					$tablename=$fieldInfos[0];
					$fieldname=$fieldInfos[1];
				}
				else { 
					$value=$fieldInfos[0].".".$fieldInfos[1];
				}
			}
			elsif (grep $_ eq $argumentType, qw/INT_ITEM DECIMAL_ITEM REAL_ITEM STRING_ITEM/) {
				$value=$whereArgument->getValue();
			}
			#	foreach my $sub_item (@{$whereArgument->getCondItems()}) {
			#		handleWhere($sub_item);
			#	}
		}
		if (defined $fieldname && defined $value) {
			$sqlv_tables{"Tables"}{getSqlTableName($tablename)}{$tablename}
						{"CONDITION"}{$fieldname}{"VALUE"}=$value;
		}
	}
}

sub handleFunctionInWhere($$) {
	my ($function,$destination) = @_;
	my $functionAlias = getUniqueFunctionAlias($function, 0);
	
	foreach my $functionArgument (@{$function->getArguments()}) {
		my $argumentType = $functionArgument->getType();
		if ($argumentType eq 'FIELD_ITEM') {
			my $tableName = getItemTableName($functionArgument);
			if ($tableName eq "?") {
				setWarning("No alias field ignored",$functionArgument->getFieldName(),"field","WHERE");
			}
			$sqlv_tables{"Tables"}{getSqlTableName($tableName)}{$tableName}
								  {"OUTPUT"}{$functionArgument->getFieldName()}{$functionAlias}
								 =$functionArgument->getAlias() 
							   || $functionArgument->getFieldName();
		}
		elsif (grep $_ eq $argumentType, qw/INT_ITEM DECIMAL_ITEM REAL_ITEM STRING_ITEM/) {
			$sqlv_tables{"Functions"}{$functionAlias}{"Constants"}{$functionArgument->getValue()}=$functionArgument->getValue();
		}
		elsif ($argumentType eq 'FUNC_ITEM') {
			handleFunctionInWhere($functionArgument,$functionAlias);
		}
	}
	
	$sqlv_tables{"Functions"}{$functionAlias}{"name"}=$function->getFuncName();
	$sqlv_tables{"Functions"}{$functionAlias}{"to"}= $destination || "NOWHERE";

}

sub getInfosFromFieldInWhere($) {
	my ($whereArgument) = @_;
	my @fieldInfos; # table name then field name if $fieldname doesn't already exist, full field name else
	my $tableName = getItemTableName($whereArgument);
	if ($tableName eq "?") {
		setWarning("No alias field ignored",$whereArgument->getFieldName(),"field","WHERE or JOIN");
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
	if ($orderByItem->getItemType() eq 'FIELD_ITEM') {
		my $tableName = getItemTableName($orderByItem);
		if ($tableName eq "?") {
			setWarning("No alias field ignored",$orderByItem->getFieldName(),"field","ORDER BY");
		}
		else {
			$sqlv_tables{"Tables"}{getSqlTableName($tableName)}{$tableName}
						{"SORT"}{$orderByItem->getFieldName()}=$orderByItem->getDirection();
		}
	}
	else {
		setWarning("Not supported","Non-field items in ORDER BY clause", $orderByItem->getValue());
	}
}

sub handleGroupBy($) {
	my ($groupByItem) = @_;
	if ($groupByItem->getItemType() eq 'FIELD_ITEM') {
		my $tableName = getItemTableName($groupByItem);

		$sqlv_tables{"Tables"}{getSqlTableName($tableName)}{$tableName}
							  {"GROUP"}{$groupByItem->getFieldName()}=$groupByItem->getDirection();
	}
	else {
		setWarning("Not supported","Non-field items in GROUP BY clause", $groupByItem->getValue());
	}
}

sub handleHaving($) {
	my ($havingItem) = @_;
	handleSelectItem($havingItem, "NOWHERE", 0);
}

sub handleLimit($) {
	my ($limitItem) = @_;
	$sqlv_tables{"Limits"}{"Begin"} = defined(@{$limitItem}[1]) ? @{$limitItem}[1]->getValue()+0 : 0;
	$sqlv_tables{"Limits"}{"End"} = @{$limitItem}[0]->getValue()+0;
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
	if (!defined $subquery_alias) {
		my $uniqueSubqueryOutputField = getUniqueSubqueryOutputField($subquery_id);
		if ($isWhere || !defined $uniqueSubqueryOutputField) {
			setWarning("No alias","#".$subquery_id,"subquery");
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
	if ($isWhere && defined $subselectExpr) {
		if ($subselectExpr->getType() eq 'FIELD_ITEM') {
			my @fieldInfos = getInfosFromFieldInWhere($subselectExpr);
			if (@fieldInfos) {
				my($tablename, $fieldname) = @fieldInfos;
				$sqlv_tables{"Tables"}{getSqlTableName($tablename)}{$tablename}
							{"CONDITION"}{$fieldname}{$item->getSubselectType()}=$subquery_id;
			}
		}
	}
	$subquery_id=$superQuery_id;
}

sub setError {
    my $message = $_[0];
	$sqlv_tables_final{"Error"}=$message;
}

sub setWarning {
	my $warning_type = $_[0];
	my $concerned_field = $_[1];
	my @extra_info = ($_[2]);
	if (defined $_[3]) {
		push(@extra_info, $_[3]);
	}
	$sqlv_tables_final{"Warning"}{$warning_type}{$concerned_field}=\@extra_info;
}

sub getItemTableName($) {
	my ($item) = @_;
	if (defined $item->getTableName()) {
		return $item->getTableName();
	}
	if (!defined $curQuery->getTables()) {
		return undef;
	}
	else {
	 	if (scalar @{$curQuery->getTables()} == 1) {
	 		if (@{$curQuery->getTables()}[0]->getType() eq "TABLE_ITEM") {
	 			return @{$curQuery->getTables()}[0]->getTableName();
	 		}
	 		elsif (@{$curQuery->getTables()}[0]->getType() eq "SUBSELECT_ITEM") {
	 			return "-1";
	 		}
	 	}
	 }
	 return "?";
}

sub getSqlTableName($) {
	my ($tableAlias) = @_;
	if (!defined $curQuery->getTables() || !defined $tableAlias) {
		return undef;
	}
	elsif ($tableAlias eq "?") {
		return "?";
	}
	my $tableName;
	foreach my $table (@{$curQuery->getTables()}) {
		$tableName = getSqlTableNameFromTable($tableAlias,$table);
		if (defined $tableName) {
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

sub getUniqueFunctionAlias($$) {
	my ($function, $warningIfNotSpecified) = @_;
	my $functionAlias = $function->getAlias();
	if (!defined $functionAlias) {
		if ($warningIfNotSpecified) {
			my $functionName = $function->getType() eq 'SUM_FUNC_ITEM' 
				? $function->getFuncType() 
				: $function->getFuncName();
			setWarning("No alias",$functionName,"function","SELECT");
		}
		$functionAlias=scalar keys %{$sqlv_tables{"Functions"}};
		$functionAlias=$functionAlias."";
	}
	return $functionAlias;
}

sub getUniqueSubqueryOutputField($) {
	my ($current_subquery_id) = @_;
	my %subqueryData = %{$sqlv_tables_final{"Subqueries"}{$current_subquery_id}};
	if (defined $subqueryData{"Tables"}) {
		my %subqueryTables = %{$subqueryData{"Tables"}};
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
	}
	elsif (defined $subqueryData{"Constants"}) {
		my %subqueryConstants = %{$subqueryData{"Constants"}};
	 	if (scalar (keys %subqueryConstants) == 1) {
	 		my %constant = %{$subqueryConstants{(keys %subqueryConstants)[0]}};
	 		return $constant{"alias"};
	 	}
	}
	return undef;
}