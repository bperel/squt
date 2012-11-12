<?php
header('Content-type: application/json');
error_reporting(E_ALL);
//echo shell_exec('dir');
echo exec('C:\\Cygwin\\bin\\bash --login -d "echo \'a\'"');
echo shell_exec('C:\\Cygwin\\bin\\bash.exe --login -d "/var/www/htdocs/cyg.sh"');
echo '{
   "etabpost" : {
      "e" : {
         "o" : {
            "codeEntite" : "codeEntite"
         }
      }
   },
   "contrat" : {
      "co2" : {
         "o" : {
            "aaa" : "aaa"
         }
      },
      "co" : {
         "?" : {
            "typeContrat" : "C",
            "codeEntite" : "e.codeEntite",
            "numeroContrat" : "0"
         },
         "^" : {
            "dateContrat" : "ASC"
         },
         "o" : {
            "origineContrat" : "origineContrat",
            "numeroContrat" : "NUMERO"
         }
      }
   }
}
';

?>