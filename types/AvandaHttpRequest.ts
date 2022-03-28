import express from "express";
import Service from "./Service";

export default interface AvandaHttpRequest extends express.Request{
    requestId: string;
}
