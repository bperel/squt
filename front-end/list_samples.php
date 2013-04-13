<?php 
$sample_directory="./querysamples";
$samples=array();
if (is_dir($sample_directory)) {
    if ($dh = opendir($sample_directory)) {
        while (($file = readdir($dh)) !== false) {
        	// Just take the .sql files
            if (($_GET["test"]!=="false" || strpos($file,"DBI") !== 0) 
             && substr($file, -strlen(".sql")) === ".sql")
        		$samples[]=$file;
        }
        closedir($dh);
    }
	sort($samples);
    echo implode(",",$samples);
}
else {
	echo "Error : ".$sample_directory." is not a directory";
}
?>