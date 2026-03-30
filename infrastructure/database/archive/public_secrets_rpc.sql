-- Funktionen hämtar endast de uppgifter som användaren valt att visa 
-- och returnerar null för de skyddade, även om de råkar finnas i databasen.
CREATE OR REPLACE FUNCTION get_public_user_secrets(target_user_id UUID)
RETURNS TABLE (
  phone TEXT,
  address TEXT,
  zipcode TEXT,
  show_phone BOOLEAN,
  show_address BOOLEAN,
  show_zipcode BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN s.show_phone THEN s.phone ELSE NULL END,
    CASE WHEN s.show_address THEN s.address ELSE NULL END,
    CASE WHEN s.show_zipcode THEN s.zipcode ELSE NULL END,
    s.show_phone,
    s.show_address,
    s.show_zipcode
  FROM public.user_secrets s
  WHERE s.user_id = target_user_id;

-- Security Definer låter funktionen arbeta inuti den låsta tabellen för allas räkning,
-- men eftersom vi filtrerar if-satser på raderna skyddas datan ändå 100%.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
