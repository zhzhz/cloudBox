// 引入NET
const net = require('net');
const { Z_ASCII } = require('zlib');
const jsonParse_ = require('./json_parse');

let fake_dev = {};
fake_dev.value = 0;

const IDLE = 0;
const BUSY = 1;

let devsManage = [];
let devClientMap = new Map();

// let devCommuState = IDLE;
// let devCommu = [];
// let devCommuData = [];
// let client;

// 创建TCP服务器
const server = net.createServer(function (client_) {
    console.log('someones connects');

    //client = client_;//不能直接赋值

    // 接收客户端的数据
    client_.on('data', function (req) {
        //console.log('server recv client data:', data.toString('utf-8'));
        
        //不能直接处理，而要判断当前是否忙
        //根据dev_id来判断数据该发给谁处理
        let req_js = jsonParse_.jsonParse(req.toString('utf-8'));

        let dev_id = req_js.device_id[0];

        let dev = devsManage[dev_id];

        if (dev == undefined)
        {
            devsManage[dev_id] = newDev();

            dev = devsManage[dev_id];
        }

        //将客户端入数组
        dev.devCommu.push(client_);
        dev.devCommuData.push(req);

        if (dev.devCommuState == IDLE)
        {
            dev.devCommuState = BUSY;

            dev.client = dev.devCommu.shift();//从数组取出连接
            dev.devCommuData.shift();

            handleClient(req.toString('utf-8'));
        }
    });

    // 客户端连接关闭
    client_.on('close', function (err) {
        console.log('client off');
    });

    // 客户端连接错误
    client_.on('error', function (err) {
        console.log('client error',err);
    });
});

// 监听客户端的连接
server.listen(
    {
        port: 5000,
        host: '127.0.0.1',
    },
    function () {
        console.log('server start listening');
    }
);

//设置监听时的回调函数
server.on('listening', function () {
    const { address, port } = server.address();
    console.log('server is running: ' + address + ':' + port);
});

//假设备
function handleFakeTcp508neth(req, client)
{
    //从字符串构建js对象
    let req_js = jsonParse_.jsonParse(req);

    if (req_js)
    {
        if (req_js.type == "button")
        {
            //如果是按钮事件则，写变量
            fake_dev.value = req_js.value[0];

            //返回操作成功响应数据
            let reply = '{"result":"ok"}';
            client.write(reply);
        }
        else if(req_js.type == "label")
        {
            //如果是标签则，返回变量的值
            let tmp = fake_dev.value;
            let reply = '{"result":"' + tmp + '"}';
            client.write(reply);
        }
        else
        {
            throw "handleFakeTcp508neth type error";
        }
    }
    
}

//处理客户端请求
function handleClient(req)
{
    //handleFakeTcp508neth(req, client);
    handleTcp508neth(req);
}

function changeClient(dev)
{
    //如果有挂起的，解挂处理，标志位保持BUSY
    //如果没有挂起的，标志位置为IDLE
    if (dev.devCommu.length)
    {
        dev.client = dev.devCommu.shift();//如果有挂起的解挂，并处理
        let data = dev.devCommuData.shift();

        handleClient(data.toString('utf-8'));
    }
    else
    {
        dev.devCommuState = IDLE;
    }
}



function connectTcp508neth()
{
  //用nodejs API创建tcp客户端
  //假设服务器为
  let socketClient = net.connect({host:'192.168.2.10', port:502},  () => {
    console.log('connected to modbus server!');
  });
  
  socketClient.on('end', () => {
    console.log('disconnected from modbus server');
  });

  socketClient.on('data', (data) => {
    //console.log('recv data from tcp508n');
    //收到tcp508n的返回数据

    //根据当前连接找到对应的设备id号
    let dev_id = devClientMap.get(socketClient);

    //根据id号找到variable的值
    let dev = devsManage[dev_id];
    let variable = dev.variable;
    
    if (data[7] == 0x01)
    {
        //如果是标签，返回变量的值
        //console.log('recv data from tcp508n: ', data);
        let tmp = (data[9] & (1 << variable)) >> variable;
        let replyRead = '{"result":"' + tmp + '"}';
        dev.client.write(replyRead);
    }
    else if(data[7] == 0x05)
    {
        //如果是按钮，返回操作成功响应数据
        let replyWrite = '{"result":"ok"}';
        dev.client.write(replyWrite);//返回数据给浏览器端
    }

    changeClient(dev);
});

  return socketClient;
}



function newDev()
{
    //let initTcp508neth = false;
    let variable;

    let dev = {};
    

    dev.init = false;
    dev.client_modbus = null;
    dev.variable = variable;

    dev.devCommuState = IDLE;
    dev.devCommu = [];
    dev.devCommuData = [];
    dev.client;

    return dev;
}

function handleTcp508neth(req)
{
    //如果是第一次收到通信要求，首先创建到服务器的连接
    //从字符串构建js对象
    let req_js = jsonParse_.jsonParse(req);

    if (req_js)
    {
        let dev_id = req_js.device_id[0];

        let dev = devsManage[dev_id];

        if (dev.init == false)
        {
            dev.init = true;

            dev.client_modbus = connectTcp508neth();

            devClientMap.set(dev.client_modbus, dev_id);
        }
    
        //如果是按钮，则看看variable字段中值是多少并发送相应报文
    
        if (req_js.type == "button")
        {
            //如果是按钮事件则，写变量
            let variable = req_js.variable[0];
            let value = req_js.value[0]; 
        
            sendDataToTcp508n(dev.client_modbus, variable, value, 0x05, dev);
        }
        else if(req_js.type == "label")
        {
            let variable = req_js.variable[0];
        
            sendDataToTcp508n(dev.client_modbus, variable, null, 0x01, dev);
        }
        else
        {
            throw "handleTcp508neth type error";
        }
    }
}


function sendDataToTcp508n(client_modbus, variable, value, func, dev)
{
    dev.variable = variable;

    if (func == 0x01)
    {
        let data = [0x00, 0x00 ,0x00, 0x00, 0x00, 0x06, 0x01, 0x01, 0x00, 0x00, 0x00, 0x08];
    
        client_modbus.write(Buffer.from(data));//发送读报文给modbus服务器
    }
    else if (func == 0x05)
    {
        let data = [0x00, 0x00 ,0x00, 0x00, 0x00, 0x06, 0x01, 0x05, 0x00, 0x00, 0x00, 0x00];

        data[9] = variable;

        if (value)
        {
            data[10] = 0xff;
        }
        else
        {
            data[10] = 0x00;
        }
    
        client_modbus.write(Buffer.from(data));//发送写报文给modbus服务器
    } 
}