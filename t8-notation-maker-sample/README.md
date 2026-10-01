# T8 Notation Maker

**A live preview of this application is available at https://linsdk.github.io/t8-notation-maker**

Type a combo in plain text to get a rendered output using Tekken 8's in-game icons.

There are two pages. **`index.html`** is the editor with a live preview. **`render.html`** is a blank page containing the active notation that can be dropped into OBS as an overlay.

---

## Contents

- [Getting started](#getting-started)
- [Writing notation](#writing-notation)
  - [Directions](#directions)
  - [Attack buttons](#attack-buttons)
  - [Separators and brackets](#separators-and-brackets)
  - [Properties](#properties)
  - [EN and NUM](#en-and-num)
- [Things to know](#things-to-know)
  - [Plain text](#plain-text)
  - [Escapement](#escapement)
  - [Line breaks](#line-breaks)
  - [Title and damage](#title-and-damage)
  - [Notes](#notes)
- [Multiple combos at once](#multiple-combos-at-once)
- [The Display button](#the-display-button)
- [Language](#language)
- [Using it in OBS](#using-it-in-obs)

---

## Getting started

To run locally, open `index.html` in a browser. 

Type into the textbox or click the icons from the palette below. The preview above updates as you edit.

You can host this tool locally using a webserver such as with the `python -m http.server` method. It is only a static page with no build step required.

All assets were re-made by hand.

---

## Writing notation

This tool uses both the standard english notation and numpad notation to write down in-game commands. Since it is mostly glyph-based, it does not follow the standard universal notation as seen in https://wavu.wiki/t/Notation. The tool is designed to convey Tekken notation through icons instead of through plain text, which may differ from the standard universal notation that everyone is used to. You may play with the tool in https://linsdk.github.io/t8-notation-maker to see how it parses notation.

### Directions

You can write in the standard english notation down-forward 2 **"df+2"** or with numpad notation **"3RP"**.

### Attack buttons

`1` `2` `3` `4` for the four attack buttons.

**`+` joins buttons together.** Example:

| Input| Output |
| --- | --- |
| `1+2` | One icon: 1+2 |
| `12` | Two icons: 1, then 2 |
| `f+31` | f, then 3, then 1 |
| `f+3+1` | f, then 3+1|

### Separators and brackets

| Input | Output |
| --- | --- |
| `,` or `>` | The green next-input arrow symbol |
| `[` `]` | Bracket icons |

### Properties

Used to signify move properties such as Tornado, etc.

| Short | Full | |
| --- | --- | --- |
| `t` | `tornado` | Tornado |
| `hd` | `heatdash` | Heat dash |
| `bb` | `balconybreak` | Balcony break |
| `wbl` | `wallblast` | Wall blast |
| `wbr` | `wallbreak` | Wall break |
| `fbl` | `floorblast` | Floor blast |
| `fbr` | `floorbreak` | Floor break |

### EN and NUM

The two buttons to the left of the text box switch between notation styles.

| | Directions | Attacks | Held |
| --- | --- | --- | --- |
| **EN** | `b` `db` `d` `df` `f` `u` `ub` `uf` `n` | `1` `2` `3` `4` | Capitals  `F` |
| **NUM** | `4` `1` `2` `3` `6` `8` `7` `9` `5` | `LP` `RP` `LK` `RK` | Asterisk  `6*` |

The numpad layout, for numpad notation:

```
7 8 9      ub  u  uf
4 5 6   =   b  n   f
1 2 3      db  d  df
```

**Switching between standard and numpad notation converts what you've already typed.**

---

## Things to know

List of notation exclusive to this tool.

### Plain text

Text in quotes are printed as words instead of being converted:

```
"during Heat"f+4        "BT"1 2        "while in air"4
```

### Escapement

If you want to use a quotation mark as text in your combo, escape it with a backdash. `\"`

```
"sample \"inside quotations\" df 2"
```

### Line breaks

`\n` pushes the notation to a new line:

```
df+2 > d+4 \n "during Heat"f+4 > 2
```

Pressing **Enter** does *not* break the line. A new line in the text box is considered a separate combo.

### Title and damage

You can add a title and a damage number to your combo by placing them in front of the notation in this format:

```
"Sample Combo"(92):df+2 > d+4
```
This appears as **Sample Combo** with **92 Damage**. You can also add these elements using the symbols palette.

### Notes

A note is shown *beside* the combo, in its own block at the bottom-right, with a note icon in the corner of the main box. Notes are converted just like normal notation, so they can contain icons too.

```
df+2 > d+4 > f+2 3//"wall carry" f+2 3
```

**Invisible notes** are written with `/* … */` and are not shown in the notation. Acting as comments in plain text.

```
df+2 > d+4 > f+2 3/* check the wall splat here */
```

---

## Multiple combos at once

**Each line in the text box is its own combo.** Press Enter to get a second combo, rendered as its own block in the preview.

A numbered gutter appears down the left of the text box. **Click a number to make that the active line.**

Only the active line goes to the display, because the display shows one combo at a time.

When you have more than one line *and* the background is on, each rectangle gets a numbered strip down the left edge.

---

## The Display button

The **Display** button in the notation header opens a small panel holding
everything about the second screen:

- **Open display** — opens `render.html` in its own tab.
- **Transparency on / off** — drops the display page's black fill so it composites as an overlay (see [OBS](#using-it-in-obs)).
- **Position on the display** — a 3×3 grid placing the whole notation block: corners, edges or centre. This moves the *block*. To change how the notation lines up *inside* the block, use **Alignment** in the Text card.

---

## Language

the tool can be localized by editing the `language.txt` in this format:

```
# EN (default)
Save image: Save image
Clear: Clear
...

# JP
Save image: 画像を保存
Clear: 消去'
...

# KR
... etc.
```

---  

## Using it in OBS

1. Add a **Browser Source** with the URL of `render.html` to your local webserver or local file.

   When using the github pages preview, add a **Browser Source** with the URL: `https://linsdk.github.io/t8-notation-maker/render.html`

   ![Browser source properties, with the URL set to render.html](img/obs1.png)

2. Add another **Browser Source** with the URL of `index.html` to your local webserver or local file.

   When using the github pages preview, add another **Browser Source** with the URL: `https://linsdk.github.io/t8-notation-maker/`

   ![A second browser source, with the URL set to index.html](img/obs2.png)

3. Go into **Studio Mode**. This will allow you to hide the edit screen.

   ![The Studio Mode button](img/obs3.png)

4. Turn the `index.html` **Browser Source** off. Press the transition to push the Preview to Program.

   ![Hide the index.html source in the Sources list](img/obs4.png)

   ![Press the Transition button, pushing Preview to Program](img/obs5.png)

5. Turn the `index.html` **Browser Source** back on in order to interact.

   ![Show the index.html source again](img/obs6.png)

6. Press the **Interact** button on the `index.html` **Browser Source** to make changes to `render.html`.

   ![Press the Interact Button](img/obs7.png)
