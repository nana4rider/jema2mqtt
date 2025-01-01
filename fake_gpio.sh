#!/bin/sh

JSON_FILE="config.json"

GPIO_BASE_DIR="fake_gpio"

touch $GPIO_BASE_DIR/export
touch $GPIO_BASE_DIR/unexport

jq -r '.entities[] | .controlGpio, .monitorGpio' "$JSON_FILE" | while read -r GPIO_PIN; do
  GPIO_DIR="$GPIO_BASE_DIR/gpio$GPIO_PIN"
  mkdir -p "$GPIO_DIR"

  echo "0" >"$GPIO_DIR/value"
  echo "Created $GPIO_DIR/value with content '0'"
done
