<?php
header('Content-type: application/json');
include_once('config.php');
$query = str_replace('"','\"',str_replace("\n"," ",$_GET['query']));
error_reporting(E_ALL);
//echo $query;
echo shell_exec($PATH_TO_CYGWIN.'\\bin\\perl.exe "/usr/src/squt/parser/myparse_to_squt.pl" "'.$query.'"');

?>