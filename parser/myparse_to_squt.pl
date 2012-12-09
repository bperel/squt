# Use example : 
# perl myparse_to_squt.pl "$(<requete.sql)"
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

if ($query->getCommand() eq "SQLCOM_ERROR") {
	$sqlv_tables{"Error"}=$query->getErrstr();
}
else {
	foreach my $table (@{$query->getTables()}) {
		handleTableOrJoin($table);
	}
}
print $json->pretty->encode( \%sqlv_tables );


sub handleTableOrJoin {
	my $item = $_[0];
	if ($item->getType() eq "TABLE_ITEM") {
		my %sqlv_table_alias_fields;
		my $table=$item;
		foreach my $selectItem (@{$query->getSelectItems()}) {
			handleSelectItem($selectItem,$table->getAlias(), -1, \%sqlv_table_alias_fields);
		}
		if ($query->getOrder() != undef) {
			foreach my $orderByItem (@{$query->getOrder()}) {
				if ($orderByItem->getTableName() eq undef) {
					setWarning("No alias",$orderByItem->getFieldName(),"ORDER");
				}
				if ($orderByItem->getTableName() eq $table->getAlias()) {
					$sqlv_table_alias_fields{"SORT"}{$orderByItem->getFieldName()}=$orderByItem->getDirection();
				}
			}
		}
		if ($query->getWhere() != undef) {
			handleCondOrFunc(0,$table->getAlias(), $query->getWhere()->getArguments, \%sqlv_table_alias_fields);
		}
		if ($table ne undef) {
			$sqlv_tables{"Tables"}{$table->getTableName()}{$table->getAlias()} = \%sqlv_table_alias_fields;
		}
	}
	elsif ($item->getType() eq "JOIN_ITEM") {
		my $two_tables = 1;
		foreach my $sub_item (@{$item->getJoinItems()}) {
			handleTableOrJoin($sub_item);
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

sub handleSelectItem($$$\%) {
	my ($item,$tableAlias,$functionId,$sqlv_table_alias_fields) = @_;
	if ($item->getType() eq 'FIELD_ITEM') {
		if ($item->getTableName() eq undef) {
			setWarning("No alias",$item->getFieldName(),"SELECT");
		}
		if ($item->getTableName() eq $tableAlias) {
			$sqlv_table_alias_fields->{"OUTPUT"}{$item->getFieldName()}{$functionId}=$item->getAlias() 
																				  || $item->getFieldName();
			return 1;
		}
		else {
			return 0;
		}
	}
	elsif ($item->getType() eq 'FUNC_ITEM') {
		my $functionAlias=$item->getAlias();
		my $functionId = \$item;
		$sqlv_tables{"Functions"}{$functionId}{"name"}=$item->getFuncName();
		$sqlv_tables{"Functions"}{$functionId}{"alias"}=$functionAlias;
		foreach my $argument (@{$item->getArguments()}) {
			handleSelectItem($argument,$tableAlias,$functionId,$sqlv_table_alias_fields);
		}
	}
}

sub handleCondOrFunc($$\@\%) {
	my ($i,$tableAlias,$whereArguments,$sqlv_table_alias_fields) = @_;
	
	if ($debug) {
		print " "x$i."---- WHERE ----\n";
	}
	my $fieldname;
	my $value;
	my $j=0;
	foreach my $whereArgument (@$whereArguments) {
		
		if ($debug) {
			print " "x$i.$j++."(".$whereArgument->getType().")\n";
		}
		if ($whereArgument->getType() eq "FUNC_ITEM") {
			
			if ($debug) {
				print "\n"." "x$i.$whereArgument->getType()."\n";
				print " "x$i.$whereArgument->getFuncType()."\n";
			}
			handleCondOrFunc($i+1,$tableAlias, $whereArgument->getArguments(), $sqlv_table_alias_fields);
		}
		elsif ($whereArgument->getType() eq 'FIELD_ITEM') {
			if ($whereArgument->getTableName() eq undef) {
				setWarning("No alias",$whereArgument->getFieldName(),"WHERE or JOIN");
			}
			if ($whereArgument->getTableName() eq $tableAlias) {
				
				if ($debug) {
					print "\n"." "x$i.$whereArgument->getType()."\n";
					print " "x$i."Champ ".$whereArgument->getFieldName()."\n";
					print " "x$i.Dumper $whereArgument;
					print " "x$i."--------------\n";
				}
				$fieldname=$whereArgument->getFieldName();
			}
			elsif ($fieldname ne undef) {
				$value=$whereArgument->getTableName().".".$whereArgument->getFieldName();
			}
		}
		elsif ($whereArgument->getType() eq 'INT_ITEM' || $whereArgument->getType() eq 'DECIMAL_ITEM'|| $whereArgument->getType() eq 'REAL_ITEM'
			|| $whereArgument->getType() eq 'STRING_ITEM') {
			
			if ($debug) {
				print "\n"." "x$i.$whereArgument->getType()."\n";
				print " "x$i."Valeur fixe ".$whereArgument->getValue()."\n";
			}
			$value=$whereArgument->getValue();
		}
		#	foreach my $sub_item (@{$whereArgument->getCondItems()}) {
		#		handleCondOrFunc($i+1,$tableAlias, $sub_item, %sqlv_table_alias_fields);
		#	}
	}
	if ($fieldname ne undef && $value ne undef) {
		$sqlv_table_alias_fields->{"CONDITION"}{$fieldname}{$value}="JOIN_TYPE_STRAIGHT";
	}
}

sub setWarning {
	my $warning_type = $_[0];
	my $concerned_field = $_[1];
	my $extra_info = $_[2];
	$sqlv_tables{"Warning"}{$warning_type}{$concerned_field}=$extra_info;
}