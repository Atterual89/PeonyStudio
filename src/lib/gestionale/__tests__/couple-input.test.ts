import {describe,it,expect} from "vitest";
import {suggestCoupleSplit} from "../couple-input";
describe("coppie scritte da Alessandra",()=>{
 it.each([
  ["Aizen e Franco","Aizen","Franco"],
  ["Aizen + Franco","Aizen","Franco"],
  ["Aizen/Franco","Aizen","Franco"],
  ["Aizen / Franco","Aizen","Franco"],
 ])("propone una coppia con i separatori ammessi: %s",(raw,first,second)=>{
  expect(suggestCoupleSplit(raw)).toMatchObject({first,second});
 });
 it("non interpreta come coppia un singolo nome o una email",()=>{
  expect(suggestCoupleSplit("Christian Martelli")).toBeNull();
  expect(suggestCoupleSplit("example@email.it")).toBeNull();
  expect(suggestCoupleSplit("M/N")).toBeNull();
 });
});
