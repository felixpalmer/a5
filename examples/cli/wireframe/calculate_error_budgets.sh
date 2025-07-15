#!/bin/bash

echo "Calculating area errors for resolutions 1-8..."
echo

for res in {0..10}
do
  echo -n "Resolution $res: "
  ./area_stats.sh $res
done 
