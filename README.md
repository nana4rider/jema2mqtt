# JEMA2MQTT

[![License: ISC](https://img.shields.io/github/license/nana4rider/jema2mqtt)](LICENSE)
![GitHub Actions Test](https://github.com/nana4rider/jema2mqtt/actions/workflows/test.yml/badge.svg)
![GitHub Actions Release](https://github.com/nana4rider/jema2mqtt/actions/workflows/release.yml/badge.svg)

## 概要

JEM1427(HA端子、JEM-A端子)をGPIOに接続し、MQTT、Home Assistantで操作するためのアプリケーションです。

Raspberry Pi Zero(またはZero2)に下記の回路を取り付けることで動作します。

## 回路図

!["Circuit Diagram"](images/circuit-diagram.png)

## 必要な部品

- [XHコネクタ ベース付ポスト サイド型 4P](https://akizukidenshi.com/catalog/g/g112842/) \* 1
- [フォトカプラ TLP785(BLランク)](https://akizukidenshi.com/catalog/g/g109846/) \* 2
- [カーボン抵抗(炭素皮膜抵抗) 1/4W10kΩ](https://akizukidenshi.com/catalog/g/g125103/) \* 1
- [L型ピンソケット 1x6](https://akizukidenshi.com/catalog/g/g109862/) \* 1

## 実装サンプル

!["Frisk"](images/frisk.jpg)

## 使い方

必要な環境変数については[こちら](https://github.com/nana4rider/jema2mqtt/blob/main/src/env.ts)をご確認ください。

`config.json` に機器情報を設定

```json
{
  "deviceId": "string",
  "entities": [
    {
      "id": "string",
      "name": "name",
      "domain": "lock",
      "controlGpio": 98,
      "monitorGpio": 99
    }
  ]
}
```

### Production

```sh
npm install
npm run build
node dist/index.js
```

> [!TIP]  
> ビルド済みの[index.mjs](https://github.com/nana4rider/jema2mqtt/releases/)だけあれば動作するので、Raspberry PiにはNode.jsのインストールをした上でこのファイルのみ配置してください。  
> Raspberry Pi Zeroは[Unofficial Builds](https://unofficial-builds.nodejs.org/download/release/v20.18.1/)の`node-v20.18.1-linux-armv6l.tar.gz`をご利用ください。

### Development

```sh
npm install
npm run dev
```
