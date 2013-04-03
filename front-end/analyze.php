<?php
header('Content-type: application/json');
include_once('config.php');
error_reporting(E_ALL);

$os = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'Windows' : 'Linux';
$is_win= $os == 'Windows';

if (isset($_POST['sample'])) {
	echo file_get_contents("querysamples/".preg_replace('#\.sql$#','_expected.json',$_POST['sample']));
}
else {
	$query = str_replace('"','\"',str_replace("\n"," ",$_POST['query']));
	if (strlen($query) > $QUERY_MAX_LENGTH) {
		echo json_encode(array('Error'=>'For performance and security reasons, squt does not allow queries longer than 2000 characters'));
		exit(0);
	}
	$is_debug = isset($_POST['debug']) && $_POST['debug'] == 1;
	$path_to_perl = ($os == 'Windows' ? $PATH_TO_CYGWIN.'/bin/' : '');
	
	if (!file_exists($ERROR_OUTPUT_FILE)) {
		echo json_encode(array('Error'=>'The file '.$ERROR_OUTPUT_FILE.' has not been found in the /front-end directory.'));
		exit(0);
	}
	ob_start();
	$command = '"'.$path_to_perl.'perl" '
			  .'"'.$PATH_SQUT.'squt/parser/myparse_to_squt.pl" '
			  .'"'.$query.'" '
			  .($is_debug ? '"debug" ':'')
			  .($is_win ? ('2> '.$ERROR_OUTPUT_FILE) : ('2>&1'));
	if ($is_debug) {
		echo $command."\n\n";
	}
	
	if ($is_win) {
		$WshShell = new COM("WScript.Shell");
		$result = $WshShell->Exec($command)->StdOut->ReadAll;
		$error_output = file_get_contents($ERROR_OUTPUT_FILE);
	}
	else {
		$result = shell_exec($command);
	}
	if ($is_win && !empty($error_output)) {
		echo json_encode(array('Error'=>file_get_contents($ERROR_OUTPUT_FILE)));
	}
	else {
		if (strpos($result,'{') === false) {
			echo json_encode(array('Error'=>$result));
		}
		else {
			echo $result;
		}
	}
}

?>