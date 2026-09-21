import { describe, expect, it } from "vitest";
import {
  confirmsIdentity,
  displayIdentity,
  isUsernameEmail,
  loginToEmail,
  passwordProblem,
  usernameProblem,
  usernameToEmail,
} from "./identity";

describe("usernames", () => {
  it("accepts ordinary usernames and normalises case and a leading @", () => {
    for (const u of ["ravi", "Ravi.Kumar", "@meera_i", "dev09", "sunrise.teacher1"]) expect(usernameProblem(u), u).toBeNull();
    expect(usernameToEmail("@Ravi.Kumar")).toBe("ravi.kumar@users.paperflow.invalid");
  });

  it("rejects what the database would reject, with a reason", () => {
    for (const u of ["ab", "a b", ".dot", "dot.", "x".repeat(31), "semi;colon", "a..b", "a__b"]) {
      expect(usernameProblem(u), u).not.toBeNull();
    }
  });
});

describe("addresses", () => {
  it("maps a username to its synthetic address and leaves real emails alone", () => {
    expect(loginToEmail("ravi")).toBe("ravi@users.paperflow.invalid");
    expect(loginToEmail("@ravi")).toBe("ravi@users.paperflow.invalid");
    expect(loginToEmail(" Teacher@School.IN ")).toBe("teacher@school.in");
    expect(isUsernameEmail("ravi@users.paperflow.invalid")).toBe(true);
    expect(isUsernameEmail("ravi@gmail.com")).toBe(false);
  });

  it("shows @username for username accounts and the email otherwise", () => {
    expect(displayIdentity("ravi@users.paperflow.invalid")).toBe("@ravi");
    expect(displayIdentity("ravi@gmail.com")).toBe("ravi@gmail.com");
    expect(displayIdentity("x@users.paperflow.invalid", "ravi")).toBe("@ravi");
  });

  it("accepts either form as a typed confirmation", () => {
    expect(confirmsIdentity("@ravi", "ravi@users.paperflow.invalid")).toBe(true);
    expect(confirmsIdentity("ravi", "ravi@users.paperflow.invalid")).toBe(true);
    expect(confirmsIdentity("ravi@users.paperflow.invalid", "ravi@users.paperflow.invalid")).toBe(true);
    expect(confirmsIdentity("Teacher@School.in", "teacher@school.in")).toBe(true);
    expect(confirmsIdentity("meera", "ravi@users.paperflow.invalid")).toBe(false);
    expect(confirmsIdentity("", "ravi@users.paperflow.invalid")).toBe(false);
  });
});

describe("passwords", () => {
  it("needs 8+ characters with a letter and a number", () => {
    expect(passwordProblem("short1")).not.toBeNull();
    expect(passwordProblem("onlyletters")).not.toBeNull();
    expect(passwordProblem("12345678")).not.toBeNull();
    expect(passwordProblem("physics2026")).toBeNull();
  });
});
