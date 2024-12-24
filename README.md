# jema-mqtt

JEM1427(HA端子、JEM-A端子)をGPIOに接続し、MQTT、Home Assistantで操作するためのアプリケーションです。

## Circuit Diagram
!["Circuit Diagram"](images/circuit-diagram.png)

## Parts
* [XHコネクタ ベース付ポスト サイド型 4P](https://akizukidenshi.com/catalog/g/g112842/) * 1
* [フォトカプラ TLP785(BLランク)](https://akizukidenshi.com/catalog/g/g109846/) * 2
* [カーボン抵抗(炭素皮膜抵抗) 1/4W10kΩ](https://akizukidenshi.com/catalog/g/g125103/) * 1
* [L型ピンソケット 1x6](https://akizukidenshi.com/catalog/g/g109862/) * 1

## Usage

```sh
export MQTT_BROKER="mqtt://localhost"
export MQTT_USERNAME="username"
export MQTT_PASSWORD="password"
node dist/index
```
