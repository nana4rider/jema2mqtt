import { getGPIOValue, setGPIOValue } from "@/service/gpio";
import requestJemaAccess from "@/service/jema";
import { setTimeout } from "timers/promises";

const controlGpio = 10;
const monitorGpio = 20;

vi.mock("@/service/gpio", () => {
  return {
    getGPIOValue: vi.fn(),
    setGPIOValue: vi.fn(),
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.clearAllMocks();
});

describe("sendControl", () => {
  test("制御信号の送信ができる", async () => {
    const { sendControl } = requestJemaAccess(controlGpio, monitorGpio);
    await sendControl();

    expect(setGPIOValue).toHaveBeenCalledWith(controlGpio, 1, {
      toggle: "250ms,0",
    });
  });
});

describe("getMonitor", () => {
  test("モニタ信号の値が1のときはtrueを返す", async () => {
    vi.mocked(getGPIOValue).mockResolvedValue(1);

    const { getMonitor } = requestJemaAccess(controlGpio, monitorGpio);

    await expect(getMonitor()).resolves.toBe(true);
  });

  test("モニタ信号の値が0のときはfalseを返す", async () => {
    vi.mocked(getGPIOValue).mockResolvedValue(0);

    const { getMonitor } = requestJemaAccess(controlGpio, monitorGpio);

    await expect(getMonitor()).resolves.toBe(false);
  });
});

describe("setMonitorListener", () => {
  test("イベントが発火される", async () => {
    const { setMonitorListener } = requestJemaAccess(controlGpio, monitorGpio);

    const mockGpioRead = vi.mocked(getGPIOValue);
    const mockListener = vi.fn();

    mockGpioRead.mockResolvedValue(0);
    await setMonitorListener(mockListener);
    mockGpioRead.mockResolvedValue(1);
    await setTimeout(150);
    mockGpioRead.mockResolvedValue(0);
    await setTimeout(150);

    expect(mockListener).toHaveBeenCalledTimes(2);
    expect(mockListener).toHaveBeenNthCalledWith(1, true);
    expect(mockListener).toHaveBeenNthCalledWith(2, false);
  });

  test("エラーが発生してもイベントが停止しない", async () => {
    const { setMonitorListener } = requestJemaAccess(controlGpio, monitorGpio);

    const mockGpioRead = vi.mocked(getGPIOValue);
    const mockListener = vi.fn();

    mockGpioRead.mockResolvedValue(0);
    await setMonitorListener(mockListener);
    mockGpioRead.mockRejectedValue("read error");
    await setTimeout(150);
    mockGpioRead.mockResolvedValue(1);
    await setTimeout(150);

    expect(mockListener).toHaveBeenCalledWith(true);
  });
});
