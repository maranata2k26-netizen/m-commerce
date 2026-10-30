-- Preserve cents in the legacy PRO merchant formatter. No prices or orders change.
-- Missing runtime rows are valid on a new installation; unknown existing formats
-- must be reviewed rather than silently changing unrelated numeric displays.
DO $currency$
DECLARE
  previous text;
  corrected text;
  old_format constant text := $old$style:'currency',currency:moneyCurrency,maximumFractionDigits:0$old$;
  new_format constant text := $new$style:'currency',currency:moneyCurrency,maximumFractionDigits:2$new$;
BEGIN
  SELECT content INTO previous FROM public.platform_runtime_files
  WHERE path='platform.js' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF position(old_format IN previous)=0 THEN
    IF position(new_format IN previous)>0 THEN RETURN; END IF;
    RAISE EXCEPTION 'PRO_CURRENCY_FORMAT_DRIFT';
  END IF;
  corrected := replace(previous,old_format,new_format);
  UPDATE public.platform_runtime_files
  SET content=corrected,
      sha256=encode(sha256(convert_to(corrected,'UTF8')),'hex'),
      updated_at=now()
  WHERE path='platform.js';
END $currency$;
