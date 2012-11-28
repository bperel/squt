<?php
header('Content-type: application/json');
include_once('config.php');

$agent = $_SERVER['HTTP_USER_AGENT'];
if(preg_match('/Linux/',$agent)) $os = 'Linux';
elseif(preg_match('/Win/',$agent)) $os = 'Windows';
elseif(preg_match('/Mac/',$agent)) $os = 'Mac';
else $os = 'UnKnown';

$query = str_replace('"','\"',str_replace("\n"," ",$_GET['query']));
error_reporting(E_ALL);

$path_to_perl = ($os == 'Windows' ? $PATH_TO_CYGWIN.'\\bin\\' : '');
echo shell_exec($path_to_perl.'perl "'.$PATH_SQUT.'squt/parser/myparse_to_squt.pl" "'.$query.'"');

?>