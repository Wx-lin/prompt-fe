"use client";

import { Slider } from "@base-ui/react/slider";
import styles from "./character-slider.module.css";

type Props = { label: string; value: string; choices: readonly string[]; onChange: (value: string) => void; formatValue?: (value: string) => string };
export function CharacterSlider({ label, value, choices, onChange, formatValue = (item) => item }: Props) {
  const index = choices.indexOf(value);
  // A custom value is its own stop, so it is never represented as the first preset.
  const stops = index < 0 ? [value, ...choices] : choices;
  const position = index < 0 ? 0 : index;
  const text = formatValue(value);
  return <div className={styles.row}>
    <span className={styles.label}>{label}</span>
    <Slider.Root className={styles.slider} value={position} min={0} max={stops.length - 1} step={1} largeStep={1} onValueChange={(next) => { const selected = stops[next]; if (selected !== undefined && selected !== value) onChange(selected); }}>
      <Slider.Control className={styles.control}>
        <Slider.Track className={styles.track}>
          <Slider.Indicator className={styles.indicator} />
          <Slider.Thumb className={styles.thumb} aria-label={label} aria-valuetext={text} />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
    <span className={styles.value}>{text}</span>
  </div>;
}
