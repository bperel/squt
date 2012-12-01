# Use example : 
# perl myparse_to_squt.pl "$(<requete.sql)"
#eval{require "DBIx-MyParse-0.88/lib/DBIx/MyParse.pm"}

use strict;
use DBIx::MyParse;
use Data::Dumper;
use JSON::PP;
my $json = JSON::PP->new->ascii->pretty->allow_nonref;
$Data::Dumper::Indent = 1;
my $debug = 0;

our $parser = DBIx::MyParse->new( database => "test", datadir => "/tmp/myparse");
our $query = $parser->parse($ARGV[0]);
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
	my $table = undef;
	if ($item->getType() eq "TABLE_ITEM") {
		my %sqlv_table_alias_fields;
		$table=$item;
		foreach my $item (@{$query->getSelectItems()}) {
			if ($item->getTableName() eq $table->getAlias()) {
				$sqlv_table_alias_fields{"OUTPUT"}{$item->getFieldName()}=$item->getAlias() || $item->getFieldName();
			}
		}
		if ($query->getOrder() != undef) {
			foreach my $orderByItem (@{$query->getOrder()}) {
				if ($orderByItem->getTableName() eq undef) {
					$sqlv_tables{"Warning"}{"No alias"}{$orderByItem->getFieldName()}=1;
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
				$table = @{$item->getJoinItems()}[0];
				my $table2 = @{$item->getJoinItems()}[1];
				my $field1 = @{$joinCond->getArguments()}[0];
				my $field2 = @{$joinCond->getArguments()}[1];
				
				$sqlv_tables{"Tables"}{$table->getTableName()}{$table->getAlias()}{"CONDITION"}{$field1->getFieldName()}=$table2->getAlias.".".$field2->getFieldName();
			}	
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
		$sqlv_table_alias_fields->{"CONDITION"}{$fieldname}=$value;
	}
}