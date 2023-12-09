export function formatPlayDuration(duration: number) {
  const minute = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${minute < 10 ? '0' : ''}${minute}:${seconds < 10 ? '0' : ''}${seconds}`;
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

// function parseAssFonts(data: string): string[] {
//   const lines = data.split("\n").map(item => item.trim())
//   const fonts: any = {};
//   const usableFonts: any[] = [];
//   let stylesStart = false;
//   let eventsStart = false;
//   let fontIndex = null;
//   let nameIndex = null;
//   let styleIndex = null;
//   let textIndex = null;
//   for (const text of lines) {
//     if (text.toLowerCase().includes("styles")) {
//       stylesStart = true
//     } else if (text.toLowerCase().includes("events")) {
//       eventsStart = true;
//     }
//     if (stylesStart) {
//       if (text.startsWith("Format")) {
//         const formats = text.slice(7).split(",").map(item => item.trim().toLowerCase())
//         fontIndex = formats.indexOf("fontname");
//         nameIndex = formats.indexOf("name")
//       } else if (nameIndex !== null && fontIndex !== null && text.startsWith("Style")) {
//         const items = text.slice(6).split(",").map(item => item.trim());
//         fonts[items[nameIndex]] = items[fontIndex].replace("@", "");
//       } else if (!text) {
//         stylesStart = false;
//       }
//     } else if (eventsStart) {
//       if (text.startsWith("Format")) {
//         const formats = text.slice(7).split(",").map(item => item.trim().toLowerCase())
//         styleIndex = formats.indexOf("style");
//         textIndex = formats.indexOf("text");

//       } else if (styleIndex !== null && textIndex !== null && text.startsWith("Dialogue")) {
//         const items = text.slice(9).split(",").map(item => item.trim())
//         const style = items[styleIndex].replace("*", "");
//         const dialogueFonts = [fonts[style]];
//         const dialogueText = items.slice(textIndex).join("");
//         const regex = /{.*?\\fn([^\\}]+).*}/gm;
//         let m;
//         while ((m = regex.exec(dialogueText)) !== null) {
//           // This is necessary to avoid infinite loops with zero-width matches
//           if (m.index === regex.lastIndex) {
//             regex.lastIndex++;
//           }

//           // The result can be accessed through the `m`-variable.
//           dialogueFonts.push(m[1]);
//         }
//         debugger;
//         for (const font of dialogueFonts) {
//           if (font && !usableFonts.includes(font.replace("@", ""))) {
//             usableFonts.push(font.replace("@", ""));
//           }
//         }
//       }
//     }
//   }
//   return usableFonts;
// }

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
