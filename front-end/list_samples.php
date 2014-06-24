<?php 
$sample_directory="./querysamples";
$samples=array();
if (is_dir($sample_directory)) {
    if ($dh = opendir($sample_directory)) {
        while (($file = readdir($dh)) !== false) {
        	$isSql = substr($file, -strlen(".sql")) === ".sql";
        	$isAllTests = !(isset($_GET["test"]) && $_GET["test"]==="false");
        	$isSqutTest = strpos($file,"DBI") !== 0 && strpos($file,"_") !== 0;
            if ($isSql && ($isAllTests || $isSqutTest)) {
            	$samples[]=$file;
            }
        }
        closedir($dh);
    }
	sort($samples);
    echo implode(",",$samples);
}
else {
	echo "Error : ".$sample_directory." is not a directory";
}