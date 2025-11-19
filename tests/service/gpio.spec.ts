import { getGPIOValue, setGPIOValue } from "@/service/gpio";
import * as child_process from "child_process";

vi.mock("child_process", async () => {
  const actual = await vi.importActual<typeof child_process>("child_process");
  return {
    ...actual,
    exec: vi.fn(),
  };
});

type ExecCallbackOnly = (
  command: string,
  callback: (
    error: Error | null,
    result: { stdout: string; stderr: string },
  ) => void,
) => child_process.ChildProcess;

beforeEach(() => {
  vi.resetAllMocks();
  vi.clearAllMocks();
});

describe("read", () => {
  test("gpiogetコマンドが正しく設定される", async () => {
    const mockExec = vi.mocked(child_process.exec as ExecCallbackOnly);
    mockExec.mockImplementation((_command, callback) => {
      callback(null, { stdout: "1\n", stderr: "" });
      return {} as child_process.ChildProcess;
    });

    const value = await getGPIOValue(99);

    vi.mocked(child_process.exec);

    expect(value).toBe(1);
    expect(mockExec).toHaveBeenCalledTimes(1);
    expect(mockExec.mock.calls[0][0]).toBe("gpioget --numeric --chip 0 99");
  });

  test("gpiogetコマンドが0|1以外の値を返したとき例外をスローする", async () => {
    const mockExec = vi.mocked(child_process.exec as ExecCallbackOnly);
    mockExec.mockImplementation((_command, callback) => {
      callback(null, { stdout: "\n", stderr: "" });
      return {} as child_process.ChildProcess;
    });

    const actual = getGPIOValue(99);

    await expect(actual).rejects.toThrowError();
  });

  test("gpiosetコマンドが正しく設定される", async () => {
    const mockExec = vi.mocked(child_process.exec as ExecCallbackOnly);
    mockExec.mockImplementation((_command, callback) => {
      callback(null, { stdout: "1\n", stderr: "" });
      return {} as child_process.ChildProcess;
    });

    await setGPIOValue(98, 1, { toggle: "250ms,0" });

    vi.mocked(child_process.exec);

    expect(mockExec).toHaveBeenCalledTimes(1);
    expect(mockExec.mock.calls[0][0]).toBe(
      "gpioset --chip 0 --toggle 250ms,0 98=1",
    );
  });
});
