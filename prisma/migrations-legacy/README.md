# Legacy migration history

The original migration sequence was replaced by the reviewed `0_init` baseline
because its timestamps caused a table alteration to run before the initial
schema creation on fresh databases. The original files remain available in Git
history before the Phase 14 rebaseline.
