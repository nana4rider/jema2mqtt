import requestJemaAccess from "@/service/jema";

const controlGpio = 10;
const mockControlExport = vi.fn();
const mockControlWrite = vi.fn();
const mockControlUnexport = vi.fn();
const mockControlPort = {
  export: mockControlExport,
  write: mockControlWrite,
  unexport: mockControlUnexport,
};

const monitorGpio = 20;
const mockMonitorExport = vi.fn();
const mockMonitorRead = vi.fn();
const mockMonitorUnexport = vi.fn();
const mockMonitorPort = {
  export: mockMonitorExport,
  read: mockMonitorRead,
  unexport: mockMonitorUnexport,
  onchange: (_: { value: number }) => {},
};

vi.mock("node-web-gpio", () => {
  return {
    requestGPIOAccess: () => {
      return Promise.resolve({
        ports: {
          get: (gpio: number) => {
            if (gpio === controlGpio) {
              return mockControlPort;
            } else if (gpio === monitorGpio) {
              return mockMonitorPort;
            } else {
              return undefined;
            }
          },
        },
      });
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.clearAllMocks();
});

describe("initialize", () => {
  test("制御信号GPIO、モニタ信号GPIOの初期化が正常終了", async () => {
    await requestJemaAccess(controlGpio, monitorGpio);

    expect(mockControlExport).toHaveBeenCalledWith("out");
    expect(mockMonitorExport).toHaveBeenCalledWith("in");
  });

  test("制御信号GPIOの初期化に失敗", async () => {
    const actual = requestJemaAccess(99, monitorGpio);

    await expect(actual).rejects.toThrow("GPIO(99) initialization failed.");
  });

  test("モニタ信号GPIOの初期化に失敗", async () => {
    const actual = requestJemaAccess(controlGpio, 98);

    await expect(actual).rejects.toThrow("GPIO(98) initialization failed.");
  });
});

describe("sendControl", () => {
  test("制御信号に1を送信した後0を送信", async () => {
    const { sendControl } = await requestJemaAccess(controlGpio, monitorGpio);
    await sendControl();

    expect(mockControlWrite).toHaveBeenCalledTimes(2);
    expect(mockControlWrite).toHaveBeenNthCalledWith(1, 1);
    expect(mockControlWrite).toHaveBeenNthCalledWith(2, 0);
  });
});

describe("getMonitor", () => {
  test("モニタ信号の値が1のときはtrueを返す", async () => {
    mockMonitorRead.mockReturnValueOnce(1);

    const { getMonitor } = await requestJemaAccess(controlGpio, monitorGpio);

    await expect(getMonitor()).resolves.toBe(true);
  });

  test("モニタ信号の値が0のときはfalseを返す", async () => {
    mockMonitorRead.mockReturnValueOnce(0);

    const { getMonitor } = await requestJemaAccess(controlGpio, monitorGpio);

    await expect(getMonitor()).resolves.toBe(false);
  });
});

describe("setMonitorListener", () => {
  test("イベントが発火される", async () => {
    const { setMonitorListener } = await requestJemaAccess(
      controlGpio,
      monitorGpio,
    );
    const mockListener = vi.fn();
    setMonitorListener(mockListener);
    mockMonitorPort.onchange({ value: 1 });
    mockMonitorPort.onchange({ value: 0 });
    expect(mockListener).toHaveBeenCalledTimes(2);
    expect(mockListener).toHaveBeenNthCalledWith(1, true);
    expect(mockListener).toHaveBeenNthCalledWith(2, false);
  });
});

describe("close", () => {
  test("制御信号、モニタ信号のunexportが呼び出される", async () => {
    const { close } = await requestJemaAccess(controlGpio, monitorGpio);
    await close();
    expect(mockControlUnexport).toHaveBeenCalledTimes(1);
    expect(mockMonitorUnexport).toHaveBeenCalledTimes(1);
  });

  test("失敗してもエラーを出さない", async () => {
    mockControlUnexport.mockImplementation(() => {
      throw new Error("unexport error");
    });
    const { close } = await requestJemaAccess(controlGpio, monitorGpio);
    const actual = close();
    await expect(actual).resolves.not.toThrow();
  });
});
