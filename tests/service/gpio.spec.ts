import { getGPIOValue, setGPIOValue } from "@/service/gpio";
import * as child_process from "child_process";

vi.mock("child_process", async () => {
  const actual = await vi.importActual<typeof child_process>("child_process");
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

type ExecFileCallbackOnly = (
  command: string,
  args: string[],
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
    const mockExecFile = vi.mocked(
      child_process.execFile as ExecFileCallbackOnly,
    );
    mockExecFile.mockImplementation((_command, _args, callback) => {
      callback(null, { stdout: "1\n", stderr: "" });
      return {} as child_process.ChildProcess;
    });

    const value = await getGPIOValue(99);

    expect(value).toBe(1);
    expect(mockExecFile).toHaveBeenCalledTimes(1);
    expect(mockExecFile.mock.calls[0][0]).toBe("gpioget");
    expect(mockExecFile.mock.calls[0][1]).toEqual([
      "--numeric",
      "--chip",
      "0",
      "99",
    ]);
  });

  test("gpiogetコマンドが0|1以外の値を返したとき例外をスローする", async () => {
    const mockExecFile = vi.mocked(
      child_process.execFile as ExecFileCallbackOnly,
    );
    mockExecFile.mockImplementation((_command, _args, callback) => {
      callback(null, { stdout: "x\n", stderr: "" });
      return {} as child_process.ChildProcess;
    });
    const actual = getGPIOValue(99);

    await expect(actual).rejects.toThrowError();
  });

  test("gpiosetコマンドが正しく設定される", async () => {
    const mockExecFile = vi.mocked(
      child_process.execFile as ExecFileCallbackOnly,
    );
    mockExecFile.mockImplementation((_command, _args, callback) => {
      callback(null, { stdout: "1\n", stderr: "" });
      return {} as child_process.ChildProcess;
    });

    await setGPIOValue(98, 1, { toggle: "250ms,0" });

    expect(mockExecFile).toHaveBeenCalledTimes(1);
    expect(mockExecFile.mock.calls[0][0]).toBe("gpioset");
    expect(mockExecFile.mock.calls[0][1]).toEqual([
      "--chip",
      "0",
      "--toggle",
      "250ms,0",
      "98=1",
    ]);
  });
});
