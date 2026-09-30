-- The admin is Tony now. "Boss" in the code, "Tony" on the page.
ALTER TABLE users RENAME COLUMN is_sal TO is_boss;

-- The old Tony_Buick regular becomes Vito, so there's only one Tony on the block.
UPDATE users SET username = 'Vito_DoubleParked' WHERE username = 'Tony_Buick' AND is_bot = 1;

UPDATE markets SET outcomes = replace(outcomes, 'Tony (Buick)', 'Vito (double-parked)') WHERE slug = 'block-president';

UPDATE markets SET
  title    = replace(title, 'Sal', 'Tony'),
  blurb    = replace(blurb, 'Sal', 'Tony'),
  rules    = replace(rules, 'Sal', 'Tony'),
  outcomes = replace(outcomes, 'Sal', 'Tony');

-- It's Tony's Buick, and Tony resolves it. He says it's fine.
UPDATE markets SET rules = '[["Resolves YES","Orange envelope on the windshield."],["Resolves NO","Tony moves it, or the street sweeper skips the block again."],["Resolved by","Tony. Yes, it''s his car. He says it''s fine."]]'
WHERE slug = 'tony-buick';
