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
$is_debug = isset($_GET['debug']) && $_GET['debug'] == 1;
$path_to_perl = ($os == 'Windows' ? $PATH_TO_CYGWIN.'/bin/' : '');

if (!file_exists($ERROR_OUTPUT_FILE)) {
	echo 'Error - The file '.$ERROR_OUTPUT_FILE.' has not been found in the /front-end directory.';
	exit(0);
}
ob_start();
$command = '"'.$path_to_perl.'perl" '
		  .'"'.$PATH_SQUT.'squt/parser/myparse_to_squt.pl" '
		  .'"'.$query.'" '
		  .($is_debug ? '"debug" ':'')
		  .'1> '.$ERROR_OUTPUT_FILE;

if ($os == 'Windows') {
	$WshShell = new COM("WScript.Shell");
	$result = $WshShell->Exec($command)->StdOut->ReadAll;
}
else {
	$result = shell_exec($command);
}
$error_output = file_get_contents($ERROR_OUTPUT_FILE);
if (!empty($error_output)) {
	echo json_encode(array('Error'=>file_get_contents($ERROR_OUTPUT_FILE)));
}
else {
	echo $result;
}

?>