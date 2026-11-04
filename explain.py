"""Explainability + ablation helpers (owner: P4). Optional but planned.

UNTESTED in this skeleton: requires `shap` and `matplotlib` (see requirements.txt).
"""


def shap_summary(model, X, out_path="outputs/shap_summary.png", max_rows=5000):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import shap
    Xs = X.sample(min(len(X), max_rows), random_state=0)
    values = shap.TreeExplainer(model).shap_values(Xs)
    shap.summary_plot(values, Xs, show=False)
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()
    return out_path


# TODO(P4): ablation runner - add one feature group at a time (base columns,
# + rolling rain, + API/soil, + temperature proxies, + extra stations, + peak
# model), record LOSO-CV and forward-split metrics for each in docs/ablation_log.md.
