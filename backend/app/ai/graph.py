"""LangGraph orchestration boundary: routes only allowlisted research tools.
No SQL, shell, arbitrary URL, brokerage, or trading tools are exposed to the model.
"""
from langgraph.graph import StateGraph, END

def build_research_graph():
    graph = StateGraph(dict)
    graph.add_node("research", lambda state: state)
    graph.set_entry_point("research")
    graph.add_edge("research", END)
    return graph.compile()
