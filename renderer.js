const crypto_node = require('crypto');

/** TEST */
async function testIt() {
    location.reload()
}

async function testIt1() {
    const algo = "SHA-256";

// input data:
    const str = "あいうえお";

// generate hash!
    crypto.subtle.digest(algo, new TextEncoder().encode(str)).then(x => {
        console.log(`"${str}" => ${algo} (ArrayBuffer):`, x); // ArrayBuffer
        const hex = hexString(x); // convert to hex string.
        console.log(`"${str}" => ${algo} (Hex):`, hex);
    });


}

/** BASE */
function hexString(buffer) {
    const byteArray = new Uint8Array(buffer);
    const hexCodes = [...byteArray].map(value => {
        const hexCode = value.toString(16);
        const paddedHexCode = hexCode.padStart(2, '0');
        return paddedHexCode;
    });
    return hexCodes.join('');
}

async function sha256Hash(str) {
    // Convert string to ArrayBuffer
    const buff = new Uint8Array([].map.call(str, (c) => c.charCodeAt(0))).buffer;
    // Calculate digest
    const digest = await crypto.subtle.digest('SHA-256', buff);
    // Convert ArrayBuffer to hex string
    // (from: https://stackoverflow.com/a/40031979)
    return [].map.call(new Uint8Array(digest), x => ('00' + x.toString(16)).slice(-2)).join('');
}

function paddingKey(key) {
    for (let i = key.length; i < 32; i++) {
        key += "0"
    }
    return key
}

function paddingIV(iv) {
    for (let i = iv.length; i < 16; i++) {
        iv += "0"
    }
    return iv
}

const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

const ServiceUUID = "a9d158bb-9007-4fe3-b5d2-d3696a3eb067"
const CharacteristicUUID = "52dc2801-7e98-4fc2-908a-66161b5959b0"
const CharacteristicLIFFWriteUUID = "52dc2801-7e98-4fc2-908a-66161b5959b0"
const CharacteristicLIFFReadUUID = "52dc2802-7e98-4fc2-908a-66161b5959b0"
const shareKey = "share_key"
const iv = "iv_key";
const decoder = new TextDecoder('utf-8');
const encoder = new TextEncoder();

function random(N) {
    const base = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return Array.from(Array(N)).map(() => base[Math.floor(Math.random() * base.length)]).join('')
}

async function init() {
    const device_name = document.getElementById('device_name').value
    if (!device_name) {
        alert("デバイス名が指定されていません")
    }
    const device = await navigator.bluetooth.requestDevice({
        // acceptAllDevices: true,
        filters: [{services: [ServiceUUID]}, {name: device_name},],
    });

    console.log(device)
    document.getElementById('device-id').innerHTML = device.id
    document.getElementById('device-name').innerHTML = device.name || `ID: ${device.id}`
    return device
}

async function tethering_on() {
    // init log
    let log_area = document.getElementById("log");
    log_area.innerHTML = '';
    log_area.insertAdjacentHTML("beforebegin", "loading... <br>");
    // init process
    const device = await init()
    const common_key = document.getElementById('common_key').value
    if (!common_key) {
        alert("共通鍵が空です")
        return
    }
    const iv_key = document.getElementById('iv_key').value
    if (!iv_key) {
        alert("iv鍵が空です")
        return
    }
    const server = await device.gatt.connect()
    const service = await server.getPrimaryService(ServiceUUID)
    const characteristic_write = await service.getCharacteristic(CharacteristicLIFFWriteUUID)
    const characteristic_read = await service.getCharacteristic(CharacteristicLIFFReadUUID)

    // phase0
    const client_random = random(20)
    const phase0_send = "!" + client_random

    // log
    log_area.insertAdjacentHTML("beforebegin", "phase0 send data: " + phase0_send + "<br>");

    characteristic_write.writeValue(encoder.encode(phase0_send))
    const pre_shared_hash_key = await sha256Hash(shareKey)
    // log
    log_area.insertAdjacentHTML("beforebegin", "phase0 OK<br>");

    // phase1
    const phase1_raw = await characteristic_read.readValue()
    let server_mix_hash = "";
    let server_random = "";
    console.log(phase1_raw)
    const phase1_str = decoder.decode(phase1_raw)
    if (phase1_str[0] === "!") {
        const phase1_array = phase1_str.substr(1).split(",")
        server_mix_hash = phase1_array[0]
        server_random = phase1_array[1]
    } else {
        console.log("phase1 error")
        alert("phase1の処理に失敗しました")
        return
    }
    // log
    log_area.insertAdjacentHTML("beforebegin", "phase1 OK<br>");
    // phase2
    const phase2_mix_hash = await sha256Hash(server_random + client_random + pre_shared_hash_key)
    console.log("phase2_mix_hash: " + phase2_mix_hash)
    // log
    log_area.insertAdjacentHTML("beforebegin", "phase2_mix_hash" + phase2_mix_hash + "<br>");

    const phase2_send = "@" + phase2_mix_hash
    characteristic_write.writeValue(encoder.encode(phase2_send))
    // log
    log_area.insertAdjacentHTML("beforebegin", "phase2 OK<br>");
    // phase3
    const phase3_mix_hash = await sha256Hash(server_random + client_random)
    console.log("phase3_mix_hash: " + phase3_mix_hash)
    const access_token = await sha256Hash(phase3_mix_hash + pre_shared_hash_key)
    console.log("AccessToken: " + access_token)
    // log
    log_area.insertAdjacentHTML("beforebegin", "phase3 OK<br>");

    // tethering on process
    const now_date = new Date();
    const send_data = now_date.toISOString() + "," + access_token + "," + "tethering_on"

    const key = Buffer.from(paddingKey(common_key))
    const iv_tmp = Buffer.from(paddingIV(iv_key))
    const ciper = await crypto_node.createCipheriv("aes-256-cbc", key, iv_tmp)
    let enc_text = ciper.update(send_data, 'utf-8', 'base64')
    enc_text += ciper.final('base64')
    // delayしないと、gattの送信に失敗する
    await sleep(500);
    const tethering_on_send = "#" + enc_text
    console.log(tethering_on_send)
    characteristic_write.writeValue(encoder.encode(tethering_on_send))
    // log
    log_area.insertAdjacentHTML("beforebegin", "Send...<br>");
    await sleep(500)
    const response_raw = await characteristic_read.readValue()

    const response = decoder.decode(response_raw)
    const decipher = crypto_node.createDecipheriv("aes-256-cbc", key, iv_tmp)
    try {
        let dec = decipher.update(response, 'base64', 'utf8')
        dec += decipher.final('utf8')
        console.log(dec)
        log_area.insertAdjacentHTML("beforebegin", dec + "<br>");
    } catch (e) {
        log_area.insertAdjacentHTML("beforebegin", "<font color=\"red\">認証エラー [" + e + "] </font>");
    }

    server.disconnect()
    return 0
}

async function tethering_off() {
    // init log
    let log_area = document.getElementById("log");
    log_area.innerHTML = '';
    log_area.insertAdjacentHTML("beforebegin", "loading... <br>");
    // init process
    const device = await init()
    const common_key = document.getElementById('common_key').value
    if (!common_key) {
        alert("共通鍵が空です")
    }
    const iv_key = document.getElementById('iv_key').value
    if (!iv_key) {
        alert("iv鍵が空です")
    }

    const server = await device.gatt.connect()
    const service = await server.getPrimaryService(ServiceUUID)
    const characteristic_write = await service.getCharacteristic(CharacteristicLIFFWriteUUID)
    const characteristic_read = await service.getCharacteristic(CharacteristicLIFFReadUUID)

    // phase0
    const client_random = random(20)
    const phase0_send = "!" + client_random
    // log
    log_area.insertAdjacentHTML("beforebegin", "phase0 send: " + phase0_send + "<br>");

    characteristic_write.writeValue(encoder.encode(phase0_send))
    const pre_shared_hash_key = await sha256Hash(shareKey)
    // log
    log_area.insertAdjacentHTML("beforebegin", "phase0 OK<br>");

    // phase1
    // await sleep(1000);
    const phase1_raw = await characteristic_read.readValue()
    let server_mix_hash = "";
    let server_random = "";
    console.log(phase1_raw)
    const phase1_str = decoder.decode(phase1_raw)
    if (phase1_str[0] === "!") {
        const phase1_array = phase1_str.substr(1).split(",")
        server_mix_hash = phase1_array[0]
        server_random = phase1_array[1]
    } else {
        console.log("phase1 error")
        alert("phase1の処理に失敗しました")
        return
    }
    // log
    log_area.insertAdjacentHTML("beforebegin", "phase1 OK<br>");

    // phase2
    const phase2_mix_hash = await sha256Hash(server_random + client_random + pre_shared_hash_key)
    // log
    log_area.insertAdjacentHTML("beforebegin", "phase2_mix_hash send: " + phase2_mix_hash + "<br>");

    const phase2_send = "@" + phase2_mix_hash
    characteristic_write.writeValue(encoder.encode(phase2_send))
    // log
    log_area.insertAdjacentHTML("beforebegin", "phase2 OK<br>");

    // phase3
    const phase3_mix_hash = await sha256Hash(server_random + client_random)
    console.log("phase3_mix_hash: " + phase3_mix_hash)
    const access_token = await sha256Hash(phase3_mix_hash + pre_shared_hash_key)
    console.log("AccessToken: " + access_token)
    // log
    log_area.insertAdjacentHTML("beforebegin", "phase3 OK<br>");

    // tethering on process
    const now_date = new Date();
    const send_data = now_date.toISOString() + "," + access_token + "," + "tethering_off"

    const key = Buffer.from(paddingKey(common_key))
    const iv_tmp = Buffer.from(paddingIV(iv_key))
    const ciper = await crypto_node.createCipheriv("aes-256-cbc", key, iv_tmp)
    let enc_text = ciper.update(send_data, 'utf-8', 'base64')
    enc_text += ciper.final('base64')
    // delayしないと、gattの送信に失敗する
    await sleep(500);
    const tethering_on_send = "#" + enc_text
    console.log(tethering_on_send)
    characteristic_write.writeValue(encoder.encode(tethering_on_send))
    // log
    log_area.insertAdjacentHTML("beforebegin", "Send...<br>");

    const response_raw = await characteristic_read.readValue()
    const response = decoder.decode(response_raw)

    const decipher = crypto_node.createDecipheriv("aes-256-cbc", key, iv_tmp)
    try {
        let dec = decipher.update(response, 'base64', 'utf8')
        dec += decipher.final('utf8')
        console.log(dec)
        log_area.insertAdjacentHTML("beforebegin", dec + "<br>");
    } catch (e) {
        log_area.insertAdjacentHTML("beforebegin", "<font color=\"red\">認証エラー [" + e + "] </font>");
    }

    server.disconnect()
    return 0
}

// document.getElementById('tethering_on2').addEventListener('click', init_auth)
document.getElementById('tethering_off').addEventListener('click', tethering_off)
document.getElementById('tethering_on').addEventListener('click', tethering_on)
document.getElementById('battery_level').addEventListener('click', testIt1)
document.getElementById('clickme').addEventListener('click', testIt)
document.getElementById('clickme1').addEventListener('click', testIt1)