-- Add transfer loss tracking fields to batches table
-- Records juice lost during transfer from press run to vessel (e.g., spillage, open valve)

ALTER TABLE batches ADD COLUMN transfer_loss_l DECIMAL(10, 3);
ALTER TABLE batches ADD COLUMN transfer_loss_notes TEXT;

COMMENT ON COLUMN batches.transfer_loss_l IS 'Juice volume lost during transfer from press run to vessel, in liters';
COMMENT ON COLUMN batches.transfer_loss_notes IS 'Reason for transfer loss (e.g., open valve, spillage)';
