<?php 
$sample_directory="./querysamples";
$samples=array();
if (is_dir($sample_directory)) {
    if ($dh = opendir($sample_directory)) {
        while (($file = readdir($dh)) !== false) {
            if ($file !== '.' && $file !== '..')
        	$samples[]=$file;
        }
        closedir($dh);
    }
    echo implode(",",$samples);
}
else {
	echo "Error : ".$sample_directory." is not a directory";
}
?>