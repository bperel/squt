# Use example : 
# perl parse.pl "$(<requete.sql)"
eval{require "DBIx-MyParse-0.88/lib/DBIx/MyParse.pm"}

use strict;
use DBIx::MyParse;
use Data::Dumper;
use JSON::PP;
my $json = JSON::PP->new->ascii->pretty->allow_nonref;

our $parser = DBIx::MyParse->new( database => "test" );
our $query = $parser->parse($ARGV[0]);
our %sqlv_tables;

print "Dumped:\n";
print Dumper $query;

foreach my $table (@{$query->getTables()}) {
	handleTableOrJoin($table);
}

print "\n====================================\n";
print $json->pretty->encode( \%sqlv_tables ); # pretty-printing
print "\n====================================\n";

open FILE, ">result.json" or die $!;
print FILE $json->pretty->encode( \%sqlv_tables );
close FILE;

print "\n Tables : \n\n";

while ((my $tableName, my $tableAliases) = each (%sqlv_tables)) {
	print Dumper $tableAliases;
}
#printsqlv();

print "\n";

sub handleTableOrJoin {
	my $item = $_[0];
	if ($item->getType() eq "TABLE_ITEM") {
		my %sqlv_table_alias_fields;
		my $table=$item;
		foreach my $item (@{$query->getSelectItems()}) {
			if ($item->getTableName() eq $table->getAlias()) {
				$sqlv_table_alias_fields{"o"}{$item->getFieldName()}=$item->getAlias() || $item->getFieldName();
			}
		}
		foreach my $orderByItem (@{$query->getOrder()}) {
			if ($orderByItem->getTableName() eq $table->getAlias()) {
				$sqlv_table_alias_fields{"^"}{$orderByItem->getFieldName()}=$orderByItem->getDirection();
			}
		}
		if ($query->getWhere() != undef) {
			#print Dumper @{$query->getWhere()->getArguments};
			handleCondOrFunc(0,$table->getAlias(), $query->getWhere()->getArguments, \%sqlv_table_alias_fields);
		}

		
		$sqlv_tables{$table->getTableName()}{$table->getAlias()} = \%sqlv_table_alias_fields;
		
		print "\n";
	}
	else {
		foreach my $sub_item (@{$item->getJoinItems()}) {
			handleTableOrJoin($sub_item);
		}
	}
}

sub handleCondOrFunc($$\@\%) {
	my ($i,$tableAlias,$whereArguments,$sqlv_table_alias_fields) = @_;
	print " "x$i."---- WHERE ----\n";
	my $fieldname;
	my $value;
	my $j=0;
	foreach my $whereArgument (@$whereArguments) {
		print " "x$i.$j++."(".$whereArgument->getType().")\n";
		if ($whereArgument->getType() eq "FUNC_ITEM") {
			print "\n"." "x$i.$whereArgument->getType()."\n";
			print " "x$i.$whereArgument->getFuncType()."\n";
			handleCondOrFunc($i+1,$tableAlias, $whereArgument->getArguments, $sqlv_table_alias_fields);
		}
		elsif ($whereArgument->getType() eq 'FIELD_ITEM') {
			if ($whereArgument->getTableName() eq $tableAlias) {
				print "\n"." "x$i.$whereArgument->getType()."\n";
				print " "x$i."Champ ".$whereArgument->getFieldName()."\n";
				print " "x$i.Dumper $whereArgument;
				print " "x$i."--------------\n";
				$fieldname=$whereArgument->getFieldName();
			}
			elsif ($fieldname ne undef) {
				$value=$whereArgument->getTableName().".".$whereArgument->getFieldName();
			}
		}
		elsif ($whereArgument->getType() eq 'INT_ITEM' || $whereArgument->getType() eq 'DECIMAL_ITEM'|| $whereArgument->getType() eq 'REAL_ITEM'
			|| $whereArgument->getType() eq 'STRING_ITEM') {
			print "\n"." "x$i.$whereArgument->getType()."\n";
			print " "x$i."Valeur fixe ".$whereArgument->getValue()."\n";
			$value=$whereArgument->getValue();
		}
		#	foreach my $sub_item (@{$whereArgument->getCondItems()}) {
		#		handleCondOrFunc($i+1,$tableAlias, $sub_item, %sqlv_table_alias_fields);
		#	}
	}
	if ($fieldname ne undef && $value ne undef) {
		$sqlv_table_alias_fields->{"?"}{$fieldname}=$value;
	}
}