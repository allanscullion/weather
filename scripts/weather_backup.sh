#!/bin/bash
now=$(date +"%Y-%m-%d")
target_file=weather_$now.sql
target_zip=backups/$target_file.7z
echo Backing up weather database to: $target_file
mysqldump --user backup --password=backup weather > $target_file
7za a $target_zip $target_file
rm $target_file
find ./backups/*.7z -mtime +30 -delete
