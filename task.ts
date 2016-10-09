/**
 * Реализация фоновых заданий через web worker 
 * (для удобства использования web worker без внешнего файла скрипта)
 * BackgroundTaskFunction - сигнатура выполняемого метода в фоновом потоке,
 * ITaskFunctionArg - интерфейс аргумента выполняемого метода
 * ITaskFunctionArg.data - данные, передаваемые через ф-ю Run(data?:any), которая запускает задание
 * 
 * Пример:
 * 
 * const task = new tasks.BackgroundTask((arg) => {
        const a = arg.data;
        arg.completed(a*1000);
    });
    task.onComplete = (r) => console.log('result:' + r);     //1159000  
    task.Run(1159);
 * 
 */
export class BackgroundTask {
    private execFunc: string;
    constructor(f: BackgroundTaskFunction) {
        if (!f)
            throw new Error("[.ctor BackgroundTask] Передан пустой объект в конструктор!");
        this.execFunc = (<any>f).toString();
    }

    onProgressChanged: (step:number) => void;

    onComplete: <T>(result:T) => void;

    onError: (error) => void;

    /**Запуск worker'а с передачей данных в св-во data аргумента ITaskFunctionArg */
    Run(data?:any) {
        if (!this.execFunc)
            return;
        const runEvent: ITaskMessage<any> = {
            data: [this.execFunc, data],
            type: TaskEventType.exec
        };
        this.worker && this.worker.postMessage(runEvent);
    }

    /**Загружает внешние библиотеки в контекст worker'а 
     * Пример:
     * t.LoadLibrary('http://localhost:8080/mylibrary.js');
    */
    LoadLibrary(...libs:string[]) {
        if (!libs)
            return;
        const runEvent: ITaskMessage<any> = {
            data: libs,
            type: TaskEventType.library
        };
        this.worker && this.worker.postMessage(runEvent);
    }

    private get worker() {
        const w = BackgroundTask.workerInstance;
        w.onerror = (err) => this.onError && this.onError(err);
        w.onmessage = (e:any) => {
            const message: ITaskMessage<any> = e.data;
            switch (message.type) {
                case TaskEventType.complete:
                    this.onComplete && this.onComplete(message.data);
                    break;   
                case TaskEventType.reportProgress:
                    this.onProgressChanged && this.onProgressChanged(message.data);
                    break;
                case TaskEventType.error:
                    this.onError && this.onError(message.data);
                    break;
                default:
                    break;
            }
        };
        return w;
    }

    private static _worker:Worker;
    private static get workerInstance() {
        if (!BackgroundTask._worker)
            BackgroundTask._worker = BackgroundTask.buildWorker();
        return BackgroundTask._worker;
    }

    private static buildWorker():Worker {
        const sandbox = () => {
            const _pushMessage = <T>(data:ITaskMessage<T>) => {
                (postMessage as any)(data);
            }

            const _reportProgress = (step) => {
                _pushMessage<number>({
                    type: 1,
                    data: step
                });
            }

            const _onComplete = (result) => {
                _pushMessage<any>({
                    type: 2,
                    data: result
                });
            }

            const _errorReport = (err) => {
                _pushMessage<any>({
                    type: 3,
                    data: err
                });
            }

            const _sandboxExecute = (arg:any[]) => {
                const f = new Function("return " + arg[0])();
                try {
                    const param: ITaskFunctionArg<any> = {
                        data: arg[1],
                        reportProgress: _reportProgress,
                        errorReport: _errorReport,
                        completed: _onComplete
                    };
                    f(param);
                } catch (e) {
                    _errorReport(e);
                }
            } 

            onmessage = (e) => {
                const message: ITaskMessage<any> = e.data;
                switch (message.type) {
                    case 5:
                        importScripts(message.data);
                        break;   
                    case 4:
                        _sandboxExecute(message.data);
                        break;
                    default:
                        break;
                }
            };
        }

        let code = sandbox.toString();
        code = code.substring(code.indexOf("{")+1, code.lastIndexOf("}"));

        const blob = new Blob([code], {type: "application/javascript"});
        return new Worker(URL.createObjectURL(blob));
    }
}

export type BackgroundTaskFunction = (arg:ITaskFunctionArg<any>) => any;

export enum TaskEventType {
    reportProgress = 1,
    complete = 2,
    error = 3,
    exec = 4,
    library = 5
}

export interface ITaskMessage <T> {
    type: TaskEventType,
    data: T
}

export interface ITaskFunctionArg <T> {
    reportProgress: (step:number) => void;
    errorReport: (err) => void;
    completed: (data: any) => void;
    data: T;
}