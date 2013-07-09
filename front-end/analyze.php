<?php
header('Content-type: application/json');
error_reporting(E_ALL);
$conf = parse_ini_file("conf.ini");
$error_output_file=$conf['error_output_file'];

$os = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'Windows' : 'Linux';
$is_win= $os == 'Windows';

if (isset($_POST['sample'])) {
	echo file_get_contents("querysamples/".preg_replace('#\.sql$#','_expected.json',$_POST['sample']));
}
else {
	$query = str_replace('"','\"',str_replace("\n"," ",str_replace('\\"','\\\"',$_POST['query'])));
	$query = preg_replace('#[\s\t]+$#','',$query);
	if (strlen($query) > $conf['query_max_length']) {
		echo json_encode(array('Error'=>'For performance and security reasons, squt does not allow queries longer than 2000 characters'));
		exit(0);
	}
	$is_debug = isset($_POST['debug']) && $_POST['debug'] == 1;
	$path_to_perl = ($os == 'Windows' ? $conf['path_to_cygwin'].'/bin/' : '');
	
	if (!file_exists($error_output_file)) {
		echo json_encode(array('Error'=>'The file '.$error_output_file.' has not been found in the /front-end directory.'));
		exit(0);
	}
	ob_start();
	$command = '"'.$path_to_perl.'perl" '
			  .'"'.$conf['path_to_squt'].'parser/myparse_to_squt.pl" '
			  .'"'.$query.'" '
			  .($is_debug ? '"debug" ':'')
			  .($is_win ? ('2> '.$error_output_file) : ('2>&1'));
	if ($is_debug) {
		echo $command."\n\n";
	}
	
	if ($is_win) {
		$WshShell = new COM("WScript.Shell");
		$result = $WshShell->Exec($command)->StdOut->ReadAll;
		$error_output = file_get_contents($error_output_file);
	}
	else {
		$result = shell_exec($command);
	}
	if ($is_win && !empty($error_output)) {
		echo json_encode(array('Error'=>file_get_contents($error_output_file)));
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
