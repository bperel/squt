<?php
header('Content-type: application/json');
include_once('config.php');
error_reporting(E_ALL);

$agent = $_SERVER['HTTP_USER_AGENT'];
if(preg_match('/Linux/',$agent)) $os = 'Linux';
elseif(preg_match('/Win/',$agent)) $os = 'Windows';
elseif(preg_match('/Mac/',$agent)) $os = 'Mac';
else $os = 'UnKnown';

$query = str_replace('"','\"',str_replace("\n"," ",$_GET['query']));
$path_to_perl = ($os == 'Windows' ? $PATH_TO_CYGWIN.'/bin/' : '');

if (!file_exists($ERROR_OUTPUT)) {
	echo 'Error - The file '.$ERROR_OUTPUT.' has not been found in the /front-end directory.';
	exit(0);
}

ob_start();
$command = '"'.$path_to_perl.'perl" "'.$PATH_SQUT.'squt/parser/myparse_to_squt.pl" "'.$query.'" 2> '.$ERROR_OUTPUT;
$result = shell_exec($command);
$error_output = file_get_contents($ERROR_OUTPUT);
if (!empty($error_output)) {
	echo json_encode(array('Error'=>file_get_contents($ERROR_OUTPUT)));
}
else {
	echo $result;
}

?>