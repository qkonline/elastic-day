<script lang="ts">
  // The now line: a see-through gradient with a dot on the spine. No time label.
</script>

<span class="gutter"></span>
<span class="line"><span class="dot"></span></span>

<style>
  .line {
    position: relative;
    height: 2px;
    border-radius: 2px;
    background: linear-gradient(
      90deg,
      color-mix(in oklab, var(--now) 75%, transparent),
      color-mix(in oklab, var(--now) 45%, transparent)
    );
  }
  .dot {
    position: absolute;
    left: calc(var(--sc) / 2 - 5px);
    top: -4px;
    width: 10px;
    height: 10px;
    border-radius: 99px;
    background: var(--now);
    box-shadow: 0 0 0 2px var(--bg);
  }
</style>
