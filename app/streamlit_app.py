"""STRETCH ONLY - build after everything in the MUST/SHOULD list is done.

Run:  streamlit run app/streamlit_app.py
Currently just shows predictions.csv. Planned (not implemented): actual-vs-predicted
plot with 10/90% bands, flood-alert flag, SHAP for a chosen date, what-if rain slider.
"""
import pandas as pd
import streamlit as st

st.title("FLOODCAST demo (skeleton)")
try:
    pred = pd.read_csv("predictions.csv", dtype={"station_id": str})
except FileNotFoundError:
    st.warning("predictions.csv not found - run `python solution.py` first.")
    st.stop()

station = st.selectbox("Station", sorted(pred["station_id"].unique()))
sub = pred[pred["station_id"] == station].copy()
sub["date"] = pd.to_datetime(sub["date"])
st.line_chart(sub.set_index("date")["discharge_cfs"])
# TODO: bands, alerts, SHAP, what-if slider
