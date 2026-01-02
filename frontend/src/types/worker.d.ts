declare module "*?sharedworker" {
  const sharedWorkerConstructor: {
    new (): SharedWorker;
  };
  export default sharedWorkerConstructor;
}
