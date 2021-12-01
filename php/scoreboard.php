<html>
    <head></head>
<body>
<?php

$names = file('../textFiles/scores.txt');

// To check the number of lines
echo count($names).'<br>';
foreach($names as $name)
{
   echo $name.'<br>';
}
?>

</body>
</html>