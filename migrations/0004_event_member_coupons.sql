ALTER TABLE events ADD COLUMN registration_fee_paise INTEGER NOT NULL DEFAULT 0 CHECK (registration_fee_paise >= 0);
ALTER TABLE events ADD COLUMN coupon_enabled INTEGER NOT NULL DEFAULT 0 CHECK (coupon_enabled IN (0, 1));
ALTER TABLE events ADD COLUMN coupon_discount_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (coupon_discount_amount_paise >= 0);

ALTER TABLE coupons ADD COLUMN code_ciphertext TEXT;
ALTER TABLE coupons ADD COLUMN code_prefix TEXT;
ALTER TABLE event_registrations ADD COLUMN discount_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount_paise >= 0);

CREATE INDEX IF NOT EXISTS coupons_member_event_idx
  ON coupons(assigned_user_id, event_id, used_at);

CREATE UNIQUE INDEX IF NOT EXISTS coupons_one_per_member_event_idx
  ON coupons(event_id, assigned_user_id);
