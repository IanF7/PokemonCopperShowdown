"use strict";


var socket=null;
var serverInfo;
var reconnectTimeout=null;
var queue=[];

self.onmessage=function(event){
var _event$data=event.data,type=_event$data.type,server=_event$data.server,data=_event$data.data;
if(type==='connect'){
serverInfo=server;
connectToServer();
}else if(type==='send'){var _socket;
if(((_socket=socket)==null?void 0:_socket.readyState)===WebSocket.OPEN){
socket.send(data);
}else{
queue.push(data);
}
}else if(type==='disconnect'){
if(socket)socket.close();
if(reconnectTimeout)clearTimeout(reconnectTimeout);
socket=null;
}
};

function connectToServer(){
if(!serverInfo)return;

var port=serverInfo.protocol==='https'?'':":"+serverInfo.port;
var url=serverInfo.protocol+"://"+serverInfo.host+port+serverInfo.prefix;

try{
socket=new WebSocket(url.replace('http','ws')+'/websocket');
}catch(_unused){
socket=new SockJS(url,[],{timeout:5*60*1000});
}
if(socket){
socket.onopen=function(){
postMessage({type:'connected'});for(var _i2=0,_queue2=
queue;_i2<_queue2.length;_i2++){var _socket2;var msg=_queue2[_i2];(_socket2=socket)==null||_socket2.send(msg);}
queue=[];
};

socket.onmessage=function(e){
postMessage({type:'message',data:e.data});
};

socket.onclose=function(){
postMessage({type:'disconnected'});

};

socket.onerror=function(err){var _socket3;
postMessage({type:'error',data:err.message||''});
(_socket3=socket)==null||_socket3.close();
};
return;
}
return postMessage({type:'error'});
}
//# sourceMappingURL=client-connection-worker.js.map