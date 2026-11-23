import {fileURLToPath} from 'node:url';
import {createApp} from './backend/app.mjs';
import {loadSettings} from './backend/config/settings.mjs';
import {createLogger} from './backend/shared/logger.mjs';
export {createApp};
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const settings=loadSettings(),logger=createLogger({level:settings.logLevel}),server=createApp(undefined,settings);
 server.requestTimeout=settings.requestTimeoutMs;
 server.on('error',error=>{logger.error('server_failed',{code:error.code||'START_FAILED'});process.exitCode=1;});
 server.listen(settings.port,settings.host,()=>console.log('Ancient iniciado na porta '+settings.port+' ('+settings.mode+').'));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{logger.info('server_stopping',{signal});server.close(()=>process.exit(0));const timeout=setTimeout(()=>process.exit(1),10000);timeout.unref();});
}
