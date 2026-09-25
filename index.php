<?php
// Hostinger's default PHP document root can prefer index.php over index.html.
// Keep the site static while providing a reliable homepage entry point.
readfile(__DIR__ . '/index.html');
?>
