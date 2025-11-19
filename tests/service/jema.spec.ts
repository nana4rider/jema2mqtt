import { getGPIOValue, setGPIOValue } from "@/service/gpio";
import createJemaAccess from "@/service/jema";
import { setTimeout } from "timers/promises";

const controlGpio = 10;
const monitorGpio = 20;

vi.mock("@/service/gpio", async () => {
  const actual = await vi.importActual("@/service/gpio");
  return {
    ...actual,
    getGPIOValue: vi.fn(),
    setGPIOValue: vi.fn(),
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.clearAllMocks();
});

describe("sendControlPulse", () => {
  test("制御信号の送信ができる", async () => {
    const { sendControlPulse } = createJemaAccess(controlGpio, monitorGpio);
    await sendControlPulse();

    expect(setGPIOValue).toHaveBeenCalledWith(controlGpio, 1, {
      toggle: "250ms,0",
    });
  });
});

describe("readMonitor", () => {
  test("モニタ信号の値が1のときはtrueを返す", async () => {
    vi.mocked(getGPIOValue).mockResolvedValue(1);

    const { readMonitor } = createJemaAccess(controlGpio, monitorGpio);

    await expect(readMonitor()).resolves.toBe(true);
  });

  test("モニタ信号の値が0のときはfalseを返す", async () => {
    vi.mocked(getGPIOValue).mockResolvedValue(0);

    const { readMonitor } = createJemaAccess(controlGpio, monitorGpio);

    await expect(readMonitor()).resolves.toBe(false);
  });
});

describe("onMonitorChange", () => {
  test("イベントが発火される", async () => {
    const { onMonitorChange } = createJemaAccess(controlGpio, monitorGpio);

    const mockGpioRead = vi.mocked(getGPIOValue);
    const mockListener = vi.fn();

    mockGpioRead.mockResolvedValue(0);
    onMonitorChange(mockListener);
    mockGpioRead.mockResolvedValue(1);
    await setTimeout(150);
    mockGpioRead.mockResolvedValue(0);
    await setTimeout(150);

    expect(mockListener).toHaveBeenCalledTimes(2);
    expect(mockListener).toHaveBeenNthCalledWith(1, true);
    expect(mockListener).toHaveBeenNthCalledWith(2, false);
  });

  test("エラーが発生してもイベントが停止しない", async () => {
    const { onMonitorChange } = createJemaAccess(controlGpio, monitorGpio);

    const mockGpioRead = vi.mocked(getGPIOValue);
    const mockListener = vi.fn();

    mockGpioRead.mockResolvedValue(0);
    onMonitorChange(mockListener);
    mockGpioRead.mockRejectedValue("read error");
    await setTimeout(150);
    mockGpioRead.mockResolvedValue(1);
    await setTimeout(150);

    expect(mockListener).toHaveBeenCalledWith(true);
  });
});
