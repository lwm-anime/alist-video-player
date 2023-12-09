export function timeZeroPadding(num: number) {
  if (num < 10) {
    return `0${num}`;
  } else {
    return num.toString();
  }
}

export function formatPlayDuration(duration: number) {
  const hour = Math.floor(duration / (60 * 60));
  const minute = Math.floor(duration / 60) % 60;
  const second = Math.floor(duration) % 60;
  if (hour > 0) {
    return `${timeZeroPadding(hour)}:${timeZeroPadding(minute)}:${timeZeroPadding(second)}`;
  } else {
    return `${timeZeroPadding(minute)}:${timeZeroPadding(second)}`;
  }
}

export function split(str: string, sep: string, limit: number) {
  const out = [];
  let first = 0;
  while (first < str.length && --limit > 0) {
    const second = str.indexOf(sep, first);
    if (second === -1)
      break;
    out.push(str.slice(first, second));
    first = second + 1;
  }
  out.push(str.slice(first));
  return out;
}

export function parseAssFonts(data: string): string[] {
  let state = 0; // 0-none 1-style 2-event
  const getState = (key: string) => {
    if (key === "V4+ Styles")
      return 1;
    else if (key === "Events")
      return 2;
    return 0;
  };
  let styleNameIndex, styleFontnameIndex;
  const styleFonts: { [key: string]: string } = {};
  let eventStyleIndex, eventTextIndex;
  const eventStyles: Set<string> = new Set();
  const dialogueFonts: Set<string> = new Set();

  for (let line of data.split("\n")) {
    line = line.trim();
    if (line === "") continue;
    let type = 0; // 0-unknown 1-section 2-item
    let key, value;
    if (line.length >= 2 && line[0] === "[" && line[line.length - 1] === "]") {
      type = 1;
      key = line.slice(1, -1);
    } else {
      const pos = line.indexOf(":");
      if (pos !== -1) {
        type = 2;
        key = line.slice(0, pos);
        value = line.slice(pos + 1).trim();
      }
    }
    if (state === 0) {
      if (type === 1)
        state = getState(key!);
    } else if (state === 1) {
      if (type === 2) {
        if (key === "Format") {
          value!.split(",").forEach((k, i) => {
            k = k.trim();
            if (k === "Name")
              styleNameIndex = i;
            else if (k === "Fontname")
              styleFontnameIndex = i;
          });
        } else if (key === "Style") {
          const values = value!.split(",");
          const name = values[styleNameIndex!];
          let font = values[styleFontnameIndex!];
          if (font[0] === "@")
            font = font.slice(1);
          styleFonts[name] = font;
        }
      } else { // unknown or section
        state = getState(key!);
      }
    } else if (state === 2) {
      if (type === 2) {
        if (key === "Format") {
          value!.split(",").forEach((k, i) => {
            k = k.trim();
            if (k === "Style")
              eventStyleIndex = i;
            else if (k === "Text")
              eventTextIndex = i;
          });
        } else if (key === "Dialogue") {
          const values = split(value!, ",", eventTextIndex! + 1);
          const style = values[eventStyleIndex!], text = values[eventTextIndex!];
          eventStyles.add(style);
          const regex = /{.*?\\fn([^\\}]+).*}/gm;
          let m;
          while ((m = regex.exec(text)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
              regex.lastIndex++;
            }
            // The result can be accessed through the `m`-variable.
            let font = m[1];
            if (font[0] === "@")
              font = font.slice(1);
            dialogueFonts.add(font);
          }
        }
      } else { // unknown or section
        state = getState(key!);
      }
    }
  }
  for (const style of eventStyles) {
    const font = styleFonts[style];
    if (font) dialogueFonts.add(font);
  }
  console.log(dialogueFonts);
  return Array.from(dialogueFonts);
}

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function formatTimeDelta(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const years = Math.floor(seconds / (60 * 60 * 24 * 365));
  if (years) {
    return `${years} 年前`;
  }
  const months = Math.floor(seconds / (60 * 60 * 24 * 30));
  if (months) {
    return `${months} 月前`;
  }
  const days = Math.floor(seconds / (60 * 60 * 24));
  if (days) {
    return `${days} 天前`;
  }
  const hours = Math.floor(seconds / (60 * 60));
  if (hours) {
    return `${hours} 小时前`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes) {
    return `${minutes} 分钟前`;
  }
  if (seconds) {
    return `${seconds} 秒前`;
  }
  return "刚刚";
}
