# Use example : 
# perl myparse_to_squt.pl "SELECT b.a FROM b"
#eval{require "DBIx-MyParse-0.88/lib/DBIx/MyParse.pm"}

use strict;
use DBIx::MyParse;
use Data::Dumper;
use JSON::PP;
my $json = JSON::PP->new->ascii->pretty->allow_nonref;
$Data::Dumper::Indent = 1;

our $parser = DBIx::MyParse->new( database => "test", datadir => "/tmp/myparse");
our $query = $parser->parse($ARGV[0]);
our $debug = $ARGV[1] eq "debug";
our %sqlv_tables;

if ($debug) {
	print "Dumped:\n";
	print Dumper $query;
}

if ($query->getCommand() ne "SQLCOM_SELECT") {
	$sqlv_tables{"Error"}="Only SELECT queries are supported for now";
}
elsif ($query->getCommand() eq "SQLCOM_ERROR") {
	$sqlv_tables{"Error"}=$query->getErrstr();
}
else {
	my $a = $query->getTables();
	foreach my $selectItem (@{$query->getSelectItems()}) {
		handleSelectItem($selectItem,-1,1);
	}
	if ($query->getTables() != undef) {
		foreach my $item (@{$query->getTables()}) {
			if ($item->getType() eq "JOIN_ITEM") {
				handleJoin($item);
			}
		}
	}
	if ($query->getOrder() != undef) {
		foreach my $orderByItem (@{$query->getOrder()}) {
			handleOrderBy($orderByItem);
		}
	}
	my $a=$query->getWhere();
	if ($query->getWhere() != undef) {
		handleWhere($query->getWhere());
	}
}
print $json->pretty->encode( \%sqlv_tables );


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
		if ($joinCond ne undef && $two_tables) {
			if ($joinCond->getType() eq "FUNC_ITEM") {
				my $table = @{$item->getJoinItems()}[0];
				my $table2 = @{$item->getJoinItems()}[1];
				my $field1 = @{$joinCond->getArguments()}[0];
				my $field2 = @{$joinCond->getArguments()}[1];
				my $joinType = $item->getJoinType();
				if ($joinType eq undef) {
					$joinType = "JOIN_TYPE_STRAIGHT";
				}
				$sqlv_tables{"Tables"}{$table->getTableName()}{$table->getAlias()}{"CONDITION"}{$field1->getFieldName()}{$table2->getAlias.".".$field2->getFieldName()}=$joinType;
			}	
		}
	}
}

sub handleSelectItem($$$) {
	my ($item,$functionId,$directOutput) = @_;
	if ($item->getType() eq 'FIELD_ITEM') {
		if ($item->getTableName() eq undef) {
			setWarning("No alias field ignored",$item->getFieldName(),"SELECT");
		}
		$sqlv_tables{"Tables"}{getSqlTableName($item->getTableName())}{$item->getTableName()}
							  {"OUTPUT"}{$item->getFieldName()}{$functionId}=$item->getAlias() 
																		  || $item->getFieldName();
		
	}
	elsif ($item->getType() eq 'INT_ITEM' || $item->getType() eq 'DECIMAL_ITEM'|| $item->getType() eq 'REAL_ITEM'
		|| $item->getType() eq 'STRING_ITEM') {
		$sqlv_tables{"Functions"}{$functionId}{"Constants"}{$item->getValue()}=$item->getValue();
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
	foreach my $whereArgument (@{$where->getArguments()}) {
		if ($whereArgument->getType() eq 'FUNC_ITEM') {
			handleWhere($whereArgument);
		}
		elsif ($whereArgument->getType() eq 'FIELD_ITEM') {
			if ($whereArgument->getTableName() eq undef) {
				setWarning("No alias field ignored",$whereArgument->getFieldName(),"WHERE or JOIN");
				return;
			}
			if ($fieldname eq undef) {
				$tablename=$whereArgument->getTableName();
				$fieldname=$whereArgument->getFieldName();
			}
			else { # 2nd argument, also a field
				$value=$whereArgument->getTableName().".".$whereArgument->getFieldName();
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
					{"CONDITION"}{$fieldname}{$value}="JOIN_TYPE_STRAIGHT";
	}
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

sub setWarning {
	my $warning_type = $_[0];
	my $concerned_field = $_[1];
	my $extra_info = $_[2];
	$sqlv_tables{"Warning"}{$warning_type}{$concerned_field}=$extra_info;
}

sub getSqlTableName($) {
	my ($tableAlias) = @_;
	my $tableName;
	foreach my $table (@{$query->getTables()}) {
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