import torch
import torch.nn as nn

class BasinShiftMultiTask(nn.Module):
    """
    BasinShift Multi-Task LSTM Architecture.
    
    Processes 3 dynamic channels over a 30-day window and 29 static catchment features
    to simultaneously predict residual streamflow at +1, +3, +7 days and
    event occurrence logits for P95 and P99 thresholds at each horizon.
    """
    def __init__(
        self,
        dynamic_features: int = 3,
        static_features: int = 29,
        hidden_size: int = 64,
        num_layers: int = 2
    ):
        super().__init__()
        
        # Temporal encoder
        self.lstm = nn.LSTM(
            input_size=dynamic_features,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.15
        )
        
        # Static catchment encoder
        self.static_encoder = nn.Sequential(
            nn.Linear(static_features, 64),
            nn.ReLU(),
            nn.LayerNorm(64),
            nn.Dropout(0.10),
            nn.Linear(64, 64),
            nn.ReLU()
        )
        
        # Regression fusion head (predicts delta residuals for +1d, +3d, +7d)
        self.fusion = nn.Sequential(
            nn.Linear(hidden_size + 64, 128),
            nn.ReLU(),
            nn.Dropout(0.15),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 3)
        )
        
        # Event classification head (predicts 6 logits: P95+1d, P99+1d, P95+3d, P99+3d, P95+7d, P99+7d)
        self.event_head = nn.Sequential(
            nn.Linear(hidden_size + 64, 64),
            nn.ReLU(),
            nn.Dropout(0.15),
            nn.Linear(64, 6)
        )

    def forward(self, x: torch.Tensor, static: torch.Tensor):
        """
        Forward pass.
        Args:
            x: Tensor of shape (batch, 30, 3) containing normalized dynamic features.
            static: Tensor of shape (batch, 29) containing normalized static features.
        Returns:
            delta: Tensor of shape (batch, 3) for standardized residual discharge predictions.
            event_logits: Tensor of shape (batch, 6) for uncalibrated event logits.
        """
        _, (hidden, _) = self.lstm(x)
        temporal = hidden[-1]
        
        static_features = self.static_encoder(static)
        combined = torch.cat([temporal, static_features], dim=1)
        
        delta = self.fusion(combined)
        event_logits = self.event_head(combined)
        
        return delta, event_logits

