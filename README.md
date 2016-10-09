Реализация фоновых заданий через web worker 
 (для удобства использования web worker без внешнего файла скрипта)
 BackgroundTaskFunction - сигнатура выполняемого метода в фоновом потоке,
 ITaskFunctionArg - интерфейс аргумента выполняемого метода
 ITaskFunctionArg.data - данные, передаваемые через ф-ю Run(data?:any), которая запускает задание
 
 Пример:
 ```
 const task = new tasks.BackgroundTask((arg) => {
        const a = arg.data;
        arg.completed(a*1000);
    });
    task.onComplete = (r) => console.log('result:' + r);     //1159000  
    task.Run(1159);
```

